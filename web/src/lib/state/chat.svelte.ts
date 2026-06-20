// ─────────────────────────────────────────────────────────────────────────────
// The chat. Active chat + messages + the generation state machine.
//
// Generation flow:
//   1. user.send(text)
//   2. push user msg to local state + POST to server
//   3. push placeholder assistant msg (local only — id pending)
//   4. lorebook scan against recent messages
//   5. buildPrompt() → ChatMessage[]
//   6. postProcessMessages()
//   7. generateStream() — append deltas to placeholder
//   8. on finish: POST the assistant msg, replace placeholder with real one
//
// All state changes are local-first (optimistic). Server is canonical but
// we don't wait for it to draw.
//
// Pending chats. Selecting a character with no prior chats doesn't create
// one — `active` holds a synthetic PENDING_CHAT_ID chat and `messages[0]`
// is a greeting derived reactively from the character card. Edits to the
// card's first_mes / alternate_greetings flow through the derivation, so
// the user sees new greetings live while the chat is still "fresh". On any
// write mutation (send, patch, branch, …) we materialize: create the real
// chat, persist the greeting with swipes, and swap the sentinel IDs for
// the server ones. Swipe navigation stays client-only in pending — the
// alternates all come from the card anyway.
// ─────────────────────────────────────────────────────────────────────────────

import { untrack } from 'svelte';
import * as api from '../api';
import type { Chat, Message, ChatMessage, ChatMetadata, Swipe } from '../api/types';
import { generateStream } from '../api/generate';
import { buildPrompt, type GenerationType } from '../core/prompt-builder';
import { postProcessMessages } from '../core/post-process';
import { samplersToWire } from '../core/sampler-wire';
import { scanLorebook } from '../core/worldinfo-scan';
import { adaptEntry } from '../core/worldinfo-adapt';
import { evaluateMacros, type MacroEnv } from '../core/macros/engine';
import { stringHash } from '../utils/hash';
import { settings } from './settings.svelte';
import { characters } from './characters.svelte';
import { personas } from './personas.svelte';
import { connections } from './connections.svelte';
import { lorebooks } from './lorebooks.svelte';
import { preset } from './preset.svelte';
import { toasts } from './toast.svelte';
import { dialog } from './dialog.svelte';

/** Sentinel chat ID for pending (not-yet-persisted) chats. Any code that
    would round-trip to `/api/chats/__pending__` must materialize first. */
const PENDING_CHAT_ID = '__pending__';
/** Sentinel message ID for the derived greeting message inside a pending chat. */
const PENDING_GREETING_ID = '__pending_greeting__';

interface StreamingState {
  active: boolean;
  /** Local placeholder ID (negative timestamp; replaced on POST). */
  messageId: string | null;
  /** Accumulated content + reasoning so far. */
  content: string;
  reasoning: string;
  /** AbortController for the in-flight fetch. */
  abort: AbortController | null;
  /** Wall-clock start, for TTFT/duration. */
  startedAt: number;
  ttft: number | null;
}

interface PromptItemization {
  messages: ChatMessage[];
  /** Activated lorebook entry summaries (for the itemizer popup). */
  loreActivated: { id: string; keys: string[]; content: string }[];
  /** Estimated token total. */
  tokensEstimate: number;
}

let active = $state<Chat | null>(null);
let messages = $state<Message[]>([]);
/** Pending = `active.id === PENDING_CHAT_ID` — no server record yet. */
const isPending = $derived(active?.id === PENDING_CHAT_ID);
let streaming = $state<StreamingState>({
  active: false,
  messageId: null,
  content: '',
  reasoning: '',
  abort: null,
  startedAt: 0,
  ttft: null,
});
/** Last built prompt — for the itemizer popup. */
let lastPrompt = $state<PromptItemization | null>(null);

/** Impersonate target — one-way bridge to SendForm's textarea. Consumer
    clears after reading (see SendForm.svelte $effect). */
let draft = $state('');

/** Bulk-delete mode. The options menu enters it; Sheld shows a banner;
    Message renders a checkbox overlay. Selection is server IDs, not
    indexes — positions shift as deletes land. */
let deleteMode = $state(false);
let deleteSelection = $state<Set<string>>(new Set());

const isLastMessageBot = $derived(messages.at(-1)?.role === 'assistant');

export const chat = {
  get active() { return active; },
  get messages() { return messages; },
  get streaming() { return streaming; },
  get lastPrompt() { return lastPrompt; },
  get isLastMessageBot() { return isLastMessageBot; },
  get draft() { return draft; },
  get deleteMode() { return deleteMode; },
  get deleteSelection() { return deleteSelection; },
  get isPending() { return isPending; },

  /** One-way bridge to the textarea — SendForm reads and clears. */
  setDraft(v: string): void { draft = v; },

  // ── Bulk delete ──────────────────────────────────────────────────────

  enterDeleteMode(): void {
    if (messages.length === 0) return;
    deleteMode = true;
    deleteSelection = new Set();
  },

  exitDeleteMode(): void {
    deleteMode = false;
    deleteSelection = new Set();
  },

  toggleSelected(id: string): void {
    const next = new Set(deleteSelection);
    if (next.has(id)) next.delete(id); else next.add(id);
    deleteSelection = next;
  },

  async deleteSelected(): Promise<void> {
    if (deleteSelection.size === 0) return;
    if (settings.confirmDelete) {
      const ok = await dialog.confirm(
        `Delete ${deleteSelection.size} message(s)? This cannot be undone.`
      );
      if (!ok) return;
    }
    let ids = [...deleteSelection];
    if (isPending) {
      // User entered delete mode on the pending greeting and confirmed.
      // Materialize so we have real IDs to delete against.
      const map = await materializePending();
      ids = ids.map((id) => map[id] ?? id);
    }
    // Optimistic; serialise the requests — the backend doesn't have a bulk
    // endpoint and parallel deletes against the same chat are a known
    // position-reshuffle foot-gun.
    const toDelete = new Set(ids);
    messages = messages.filter((m) => !toDelete.has(m.id));
    for (const id of ids) {
      await api.messages.delete(id).catch((e) =>
        toasts.error(`Delete ${id} failed: ${String(e)}`));
    }
    chat.exitDeleteMode();
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async open(chatId: string): Promise<void> {
    const { chat: c, messages: m } = await api.chats.get(chatId);
    active = c;
    messages = m;
    // Pull the character if we don't have it yet.
    if (c.character_id && characters.active?.id !== c.character_id) {
      await characters.select(c.character_id);
    }
  },

  /** Open the most recent chat for a character, or create one. */
  async openForCharacter(charId: string): Promise<void> {
    await characters.select(charId);
    const { items } = await api.chats.list({ character_id: charId, limit: 1 });
    if (items[0]) {
      await chat.open(items[0].id);
    } else {
      await chat.startNew(charId);
    }
  },

  /** Start a fresh, un-persisted chat. The greeting (with alternates as
      swipes) is derived from the card by the pending effect below —
      editing the card's first_mes / alternate_greetings updates the
      preview live. The real chat row is created on the first write
      (see materialize()). */
  async startNew(charId: string): Promise<void> {
    await characters.select(charId);
    const now = Date.now();
    active = {
      id: PENDING_CHAT_ID,
      title: '',
      character_id: charId,
      group_id: null,
      persona_id: settings.personaId ?? null,
      metadata: {},
      created_at: now,
      updated_at: now,
    };
    // messages is populated by the pending-greeting effect (end of file).
    // Seed to [] so a character without greetings shows an empty chat
    // instead of last pending's greeting.
    messages = [];
    lastPrompt = null;
  },

  close(): void {
    active = null;
    messages = [];
    lastPrompt = null;
  },

  /** Create the real chat row + persist the pending greeting. Idempotent —
      a no-op if not pending. Returns a map from pending message IDs to their
      newly-minted server IDs so callers can re-target their patch/delete. */
  async materialize(): Promise<Record<string, string>> {
    return materializePending();
  },

  // ── Messages: CRUD ────────────────────────────────────────────────────────

  async patchMessage(id: string, patch: Parameters<typeof api.messages.patch>[1]): Promise<void> {
    if (isPending) id = (await materializePending())[id] ?? id;
    // Optimistic.
    messages = messages.map((m) => m.id === id ? { ...m, ...patch } : m);
    await api.messages.patch(id, patch);
  },

  async deleteMessage(id: string): Promise<void> {
    if (isPending) id = (await materializePending())[id] ?? id;
    messages = messages.filter((m) => m.id !== id);
    await api.messages.delete(id);
  },

  async hideMessage(id: string, hidden: boolean): Promise<void> {
    await chat.patchMessage(id, { is_hidden: hidden });
  },

  /** Insert a copy immediately after the original via after_position.
      Swipes are NOT copied — the duplicate is a fresh message that happens
      to share the text. */
  async duplicateMessage(id: string): Promise<void> {
    if (!active) return;
    if (isPending) id = (await materializePending())[id] ?? id;
    const m = messages.find((m) => m.id === id);
    if (!m || !active) return;
    const dup = await api.messages.create(active.id, {
      role: m.role,
      content: m.content,
      character_id: m.character_id,
      extra: structuredClone($state.snapshot(m.extra)),
      after_position: m.position,
    });
    const i = messages.findIndex((x) => x.id === id);
    messages = [...messages.slice(0, i + 1), dup, ...messages.slice(i + 1)];
  },

  /** Swap with the neighbor in `direction`. Optimistic local swap; the
      backend swaps positions, not content, so a failed request leaves the
      server unchanged and a refresh heals the local state. */
  async moveMessage(id: string, direction: -1 | 1): Promise<void> {
    const i = messages.findIndex((m) => m.id === id);
    if (i < 0) return;
    const j = i + direction;
    if (j < 0 || j >= messages.length) return;

    const a = messages[i]!, b = messages[j]!;
    [messages[i], messages[j]] = [b, a];
    messages = [...messages];

    await api.messages.move(id, { swap_with: b.id });
  },

  // ── Swipes ────────────────────────────────────────────────────────────────
  // swipes[i].extra carries per-swipe gen results. Restoring is a *merge*
  // over message.extra so message-level fields (bookmark_link, attachments)
  // survive a swipe; gen-result fields (reasoning, tokens, timing) get
  // overwritten by the target swipe's snapshot.

  async swipeLeft(messageId: string): Promise<void> {
    const m = messages.find((m) => m.id === messageId);
    if (!m || m.swipe_idx <= 0) return;
    const newIdx = m.swipe_idx - 1;
    const target = m.swipes[newIdx];
    await applySwipeNav(messageId, {
      swipe_idx: newIdx,
      content: target?.content ?? m.content,
      extra: { ...m.extra, ...(target?.extra ?? {}) },
    });
  },

  async swipeRight(messageId: string): Promise<void> {
    const m = messages.find((m) => m.id === messageId);
    if (!m) return;

    const atEnd = m.swipe_idx >= m.swipes.length - 1;
    // Greeting message: first message of an untainted chat. Swiping past the
    // last alternate shouldn't hit the model — you'd get an LLM-confabulated
    // greeting that wasn't on the card. Wrap to #0 instead. "It loops" is
    // discoverable; "I clicked right and nothing happened" feels broken.
    // Pending chats are always untainted; same wrap behaviour.
    const isGreeting = !active?.metadata.tainted && m === messages[0];

    if (atEnd) {
      if (isGreeting) {
        if (m.swipes.length > 1) {
          const target = m.swipes[0];
          await applySwipeNav(messageId, {
            swipe_idx: 0,
            content: target?.content ?? m.content,
            extra: { ...m.extra, ...(target?.extra ?? {}) },
          });
        }
      } else {
        await chat.generate('swipe');
      }
    } else {
      const newIdx = m.swipe_idx + 1;
      const target = m.swipes[newIdx];
      await applySwipeNav(messageId, {
        swipe_idx: newIdx,
        content: target?.content ?? m.content,
        extra: { ...m.extra, ...(target?.extra ?? {}) },
      });
    }
  },

  async deleteSwipe(messageId: string, swipeIdx: number): Promise<void> {
    if (isPending) messageId = (await materializePending())[messageId] ?? messageId;
    const updated = await api.messages.deleteSwipe(messageId, swipeIdx);
    const i = messages.findIndex((m) => m.id === messageId);
    if (i >= 0) {
      messages[i] = updated;
      messages = [...messages];
    }
  },

  // ── Branch & checkpoint ───────────────────────────────────────────────────
  // Backend doesn't distinguish: a checkpoint is a branch where we also stamp
  // bookmark_link on the source message before navigating away. The flag icon
  // in MessageButtons reads bookmark_link.

  async branch(messageId: string, opts: { checkpoint?: boolean } = {}): Promise<void> {
    if (!active) return;
    if (isPending) messageId = (await materializePending())[messageId] ?? messageId;
    if (!active) return;
    const m = messages.find((m) => m.id === messageId);
    if (!m) return;

    const branched = await api.chats.branch(active.id, {
      up_to_position: m.position,
      title: `${active.title} — branch`,
    });

    if (opts.checkpoint) {
      // Stamp before we leave — chat.open() replaces `messages`.
      await chat.patchMessage(messageId, {
        extra: { ...m.extra, bookmark_link: branched.id },
      });
    }

    await chat.open(branched.id);
    toasts.success(opts.checkpoint ? 'Checkpoint created' : 'Branched to new chat');
  },

  // ── Generation ────────────────────────────────────────────────────────────

  async send(text: string): Promise<void> {
    if (!active || streaming.active) return;
    if (!text.trim()) return;

    // Slash commands.
    if (text.startsWith('/')) {
      await runSlashCommand(text);
      return;
    }

    // First send on a pending chat creates the row and persists the greeting.
    // Snapshot the target char before we await so a rapid chat switch
    // mid-materialize doesn't deposit the user's message in the wrong chat.
    const targetCharId = active.character_id;
    if (isPending) await materializePending();
    if (!active || active.character_id !== targetCharId) return;

    // Push user message.
    const userMsg = await api.messages.create(active.id, {
      role: 'user',
      content: text,
    });
    messages = [...messages, userMsg];

    await chat.generate('normal');
  },

  async generate(type: GenerationType): Promise<void> {
    if (!active || !characters.active) {
      toasts.warning('No character selected');
      return;
    }
    if (!connections.active) {
      toasts.warning('No connection configured');
      return;
    }
    if (streaming.active) return;

    // Any generation type except the wrap-around greeting swipe hits the
    // server for message writes; materialize before we start streaming.
    if (isPending) await materializePending();
    if (!active) return;

    // ── Stage 1: lorebook scan ─────────────────────────────────────────────
    const lore = await scanLore(type);

    // ── Stage 2: build prompt ──────────────────────────────────────────────
    // The preset drives the stack now. settings.systemPrompt is the legacy
    // fallback for users with no preset (or an unmigrated one).
    const prompt = buildPrompt({
      character: characters.active.data,
      persona: { name: personas.active?.name ?? 'User', description: personas.active?.description ?? '' },
      messages,
      metadata: active.metadata,
      loreBefore: lore.before,
      loreAfter: lore.after,
      loreAtDepth: lore.atDepth,
      authorsNote: buildAuthorsNote(active.metadata),
      generationType: type,
      prompts: preset.active?.prompts,
      promptOrder: preset.active ? preset.order : undefined,
      templates: preset.active?.templates,
      systemPromptTemplate: settings.systemPrompt,
    });

    // ── Stage 3: post-process ──────────────────────────────────────────────
    // Preset's behavior.custom_prompt_post_processing wins over the legacy
    // settings.postProcess. Empty string = use legacy.
    const ppMode = preset.active?.behavior.custom_prompt_post_processing || settings.postProcess;
    const processed = postProcessMessages(prompt, ppMode);

    // Stash for the itemizer popup.
    lastPrompt = {
      messages: processed,
      loreActivated: lore.activated.map((e) => ({ id: e.id, keys: e.keys, content: e.content })),
      tokensEstimate: processed.reduce((s, m) =>
        s + Math.floor(String(m.content).length / 3.35), 0),
    };

    // ── Stage 4: stream ────────────────────────────────────────────────────
    await stream(processed, type);
  },

  stop(): void {
    streaming.abort?.abort();
  },

  async patchMetadata(patch: Partial<ChatMetadata>): Promise<void> {
    if (!active) return;
    if (isPending) await materializePending();
    if (!active) return;
    const metadata = { ...active.metadata, ...patch };
    active = { ...active, metadata };
    await api.chats.patch(active.id, { metadata });
  },
};

// ── Pending chat plumbing ──────────────────────────────────────────────────
// A pending chat has no server row. `active.id === PENDING_CHAT_ID` and
// `messages[0]` is a synthetic greeting derived from the card. Materialize
// is idempotent; call it before any server write.

// Map of pending-local message IDs → real server IDs. Plain object, not
// Map — `new Map()` in a runes module picks up a @__PURE__ annotation that
// Rollup refuses to interpret in some positions (harmless, but noisy).
type IdMap = Record<string, string>;
const EMPTY_ID_MAP: IdMap = Object.freeze({});

let materializing: Promise<IdMap> | null = null;

async function materializePending(): Promise<IdMap> {
  if (active?.id !== PENDING_CHAT_ID) return EMPTY_ID_MAP;
  // In-flight coalesce — if two writes fire back-to-back (e.g. send ->
  // generate) we don't want to race two POST /api/chats.
  if (materializing) return materializing;
  materializing = doMaterialize();
  try { return await materializing; }
  finally { materializing = null; }
}

async function doMaterialize(): Promise<IdMap> {
  if (!active || active.id !== PENDING_CHAT_ID) return EMPTY_ID_MAP;
  const charId = active.character_id;
  if (!charId) return EMPTY_ID_MAP;
  const idMap: IdMap = {};

  // Snapshot the swipe idx the user was previewing before we rebuild from
  // the card. Reading live card state (not the derived message) because the
  // derived text went through macro expansion and we want to persist the
  // same expansion the server/UI will see going forward.
  const prevGreeting = messages[0];
  const previewIdx = prevGreeting?.swipe_idx ?? 0;

  const c = await api.chats.create({
    character_id: charId,
    persona_id: active.persona_id ?? undefined,
  });

  // If the user navigated to another chat while we awaited, bail. The
  // freshly-created chat row is an orphan — delete it so we don't litter
  // the sidebar with empty rows.
  if (active?.id !== PENDING_CHAT_ID || active.character_id !== charId) {
    api.chats.delete(c.id).catch(() => {});
    return EMPTY_ID_MAP;
  }

  // Same sequential addSwipe protocol as the old startNew(). Swipe order is
  // array order, backend appends — concurrency would race.
  // Use buildPendingEnv so the persisted text matches exactly what the user
  // was previewing; buildEnv would read `messages` (the pending greeting
  // itself) and introduce lastMessage-style divergence.
  const card = characters.active?.data;
  const env = buildPendingEnv();
  const all = card
    ? [card.first_mes, ...card.alternate_greetings]
        .filter(Boolean)
        .map((g) => evaluateMacros(g, env))
    : [];

  let realGreeting: Message | null = null;
  if (all.length > 0) {
    realGreeting = await api.messages.create(c.id, {
      role: 'assistant',
      content: all[0]!,
      character_id: charId,
    });
    for (const g of all.slice(1)) {
      realGreeting = await api.messages.addSwipe(realGreeting.id, { content: g, activate: false });
    }
    // Restore the swipe the user was previewing in pending.
    if (previewIdx > 0 && previewIdx < realGreeting.swipes.length) {
      const target = realGreeting.swipes[previewIdx];
      realGreeting = await api.messages.patch(realGreeting.id, {
        swipe_idx: previewIdx,
        content: target?.content ?? realGreeting.content,
        extra: { ...realGreeting.extra, ...(target?.extra ?? {}) },
      });
    }
    idMap[PENDING_GREETING_ID] = realGreeting.id;
  }

  active = c;
  messages = realGreeting ? [realGreeting] : [];
  return idMap;
}

/** Apply a swipe-nav patch. Client-only in pending (alternates all come
    from the card); server round-trip otherwise. */
async function applySwipeNav(
  messageId: string,
  patch: Parameters<typeof api.messages.patch>[1],
): Promise<void> {
  if (isPending) {
    messages = messages.map((x) => x.id === messageId ? { ...x, ...patch } : x);
    return;
  }
  await chat.patchMessage(messageId, patch);
}

/** Build the derived greeting for a pending chat. Preserves swipe_idx
    across rebuilds so editing the card doesn't snap the user back to #1. */
function buildPendingGreeting(charId: string, greetings: string[]): Message | null {
  if (greetings.length === 0) return null;
  const prev = messages[0];
  const prevIdx = prev?.id === PENDING_GREETING_ID ? prev.swipe_idx : 0;
  const idx = Math.min(prevIdx, greetings.length - 1);
  const content = greetings[idx]!;
  const swipes: Swipe[] = greetings.length > 1
    ? greetings.map((g) => ({ content: g }))
    : [];
  return {
    id: PENDING_GREETING_ID,
    chat_id: PENDING_CHAT_ID,
    position: 0,
    role: 'assistant',
    character_id: charId,
    content,
    swipes,
    swipe_idx: idx,
    extra: {},
    is_hidden: false,
    // Stable created_at so Message.svelte's timestamp doesn't flicker on
    // every card keystroke.
    created_at: prev?.id === PENDING_GREETING_ID ? prev.created_at : Date.now(),
  };
}

/** Macro env for the pending greeting. No chat history exists yet, so
    lastMessage / lastUser / lastChar are empty. Kept separate from buildEnv
    because the effect must not track `messages` (we write to it). */
function buildPendingEnv(): MacroEnv {
  return {
    user: personas.active?.name ?? 'User',
    char: characters.active?.data.name ?? '',
    persona: personas.active?.description ?? '',
    description: characters.active?.data.description ?? '',
    personality: characters.active?.data.personality ?? '',
    scenario: characters.active?.data.scenario ?? '',
    model: connections.active?.model ?? '',
    chatVars: {},
    globalVars: {},
    messageCount: 0,
    lastMessage: '',
    lastUserMessage: '',
    lastCharMessage: '',
    generationType: 'normal',
    chatIdHash: 0,
  };
}

// Keep the pending greeting in sync with card edits. Reads are all $state
// proxies; Svelte tracks property-level so changing `description` doesn't
// rebuild (only first_mes / alternate_greetings / persona name etc do).
// The write to `messages` is untracked so this effect doesn't self-trigger.
$effect.root(() => {
  $effect(() => {
    if (active?.id !== PENDING_CHAT_ID) return;
    const card = characters.active?.data;
    const charId = characters.active?.id;
    if (!card || !charId) return;
    // openForCharacter awaits `characters.select` before starting the new
    // pending chat; in that window `characters.active` has already flipped
    // to the next char but `active.character_id` still points to the old
    // one. Don't render a greeting until they agree, or the user sees a
    // brief frame of char-B's greeting in char-A's pending chat.
    if (active.character_id !== charId) return;

    const env = buildPendingEnv();
    const greetings = [card.first_mes, ...card.alternate_greetings]
      .filter(Boolean)
      .map((g) => evaluateMacros(g, env));

    untrack(() => {
      const g = buildPendingGreeting(charId, greetings);
      messages = g ? [g] : [];
    });
  });
});

// ── Streaming state machine ──────────────────────────────────────────────────

async function stream(prompt: ChatMessage[], type: GenerationType): Promise<void> {
  const placeholder = makePlaceholder(type);
  if (placeholder) messages = [...messages, placeholder];

  const ctrl = new AbortController();
  streaming.active = true;
  streaming.messageId = placeholder?.id ?? null;
  streaming.content = '';
  streaming.reasoning = '';
  streaming.abort = ctrl;
  streaming.startedAt = Date.now();
  streaming.ttft = null;

  let finishReason: string | undefined;
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

  // Don't pass preset_id — the backend spreads params verbatim and would
  // ship prompts[] to OpenAI. Build the sampler payload here. Defaults are
  // omitted (smallest request wins), so stale provider-vocab is never an
  // issue: if you didn't touch the slider, the key isn't there to reject.
  const samplerParams = preset.active
    ? samplersToWire(preset.active.samplers)
    : {};

  try {
    for await (const delta of generateStream(
      {
        messages: prompt,
        connection_id: settings.connectionId ?? undefined,
        stream: preset.active?.samplers.stream,
        ...samplerParams,
      },
      ctrl.signal,
    )) {
      if (delta.content) {
        if (streaming.ttft === null) streaming.ttft = Date.now() - streaming.startedAt;
        streaming.content += delta.content;
        if (placeholder) {
          // Mutate in-place — the keyed #each + content reactivity handles it.
          placeholder.content = streaming.content;
          messages = [...messages];  // trigger array reactivity
        }
      }
      if (delta.reasoning) {
        streaming.reasoning += delta.reasoning;
        if (placeholder) {
          placeholder.extra = { ...placeholder.extra, reasoning: streaming.reasoning };
        }
      }
      if (delta.finish_reason) finishReason = delta.finish_reason;
      if (delta.usage) usage = delta.usage;
    }
  } catch (err) {
    if ((err instanceof Error && err.name === 'AbortError') || ctrl.signal.aborted) {
      // User hit stop — keep what we have.
      finishReason = 'aborted';
    } else {
      toasts.error(err instanceof Error ? err.message : 'Generation failed');
      // Drop the placeholder on error.
      if (placeholder) messages = messages.filter((m) => m.id !== placeholder.id);
      streaming.active = false;
      streaming.abort = null;
      return;
    }
  }

  // ── Finalize ─────────────────────────────────────────────────────────────
  await finalize(type, placeholder, finishReason, usage);

  streaming.active = false;
  streaming.abort = null;
}

/** Create the optimistic assistant message (or null for swipe — swipe edits the existing). */
function makePlaceholder(type: GenerationType): Message | null {
  if (type === 'swipe' || type === 'regenerate') {
    // Swipe/regen edit the last bot message in place. No new bubble.
    const last = messages.at(-1);
    if (last?.role === 'assistant') {
      last.content = '';
      messages = [...messages];
    }
    return last ?? null;
  }
  if (type === 'continue') {
    // Continue extends the last bot message.
    return messages.at(-1) ?? null;
  }

  // Normal and impersonate both use an ephemeral assistant bubble. For
  // impersonate, the user sees the text being drafted in the chat; on
  // finalize we drop the bubble and deposit its content into the textarea.
  return {
    id: `pending-${Date.now()}`,
    chat_id: active!.id,
    position: (messages.at(-1)?.position ?? 0) + 1024,
    role: 'assistant',
    character_id: characters.active?.id ?? null,
    content: '',
    swipes: [],
    swipe_idx: 0,
    extra: {},
    is_hidden: false,
    created_at: Date.now(),
  };
}

async function finalize(
  type: GenerationType,
  placeholder: Message | null,
  finishReason: string | undefined,
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
): Promise<void> {
  if (!active || !placeholder) return;

  // Impersonate: route the drafted text to the textarea and drop the
  // placeholder bubble. No server write — the user hasn't sent yet.
  if (type === 'impersonate') {
    messages = messages.filter((m) => m.id !== placeholder.id);
    chat.setDraft(streaming.content);
    return;
  }

  const finished = Date.now();
  const extra = {
    ...placeholder.extra,
    model: connections.active?.model,
    finish_reason: finishReason,
    token_count: usage?.completion_tokens,
    gen_started_at: streaming.startedAt,
    gen_finished_at: finished,
    time_to_first_token: streaming.ttft ?? undefined,
    reasoning: streaming.reasoning || undefined,
  };

  if (type === 'swipe') {
    // Add as new swipe; activate it. Pass the gen-result extra so the swipe
    // captures its own reasoning/timing — swiping back to an older swipe
    // restores that swipe's snapshot, not this one's.
    const real = await api.messages.addSwipe(placeholder.id, {
      content: streaming.content,
      model: connections.active?.model,
      extra: {
        reasoning: streaming.reasoning || undefined,
        gen_started_at: streaming.startedAt,
        gen_finished_at: finished,
        time_to_first_token: streaming.ttft ?? undefined,
        token_count: usage?.completion_tokens,
        finish_reason: finishReason,
        model: connections.active?.model,
      },
      activate: true,
    });
    messages = messages.map((m) => m.id === placeholder.id ? real : m);
  } else if (type === 'continue' || type === 'regenerate') {
    // Patch existing.
    await api.messages.patch(placeholder.id, { content: streaming.content, extra });
    placeholder.content = streaming.content;
    placeholder.extra = extra;
    messages = [...messages];
  } else {
    // Normal: POST the new message, replace placeholder.
    const real = await api.messages.create(active.id, {
      role: 'assistant',
      content: streaming.content,
      character_id: characters.active?.id ?? null,
      extra,
    });
    messages = messages.map((m) => m.id === placeholder.id ? real : m);
  }

  // Mark chat tainted (no longer eligible for greeting swipe).
  if (!active.metadata.tainted) {
    chat.patchMetadata({ tainted: true });
  }
}

// ── Lorebook scan plumbing ──────────────────────────────────────────────────

async function scanLore(type: GenerationType) {
  const empty = { before: [], after: [], atDepth: [], activated: [], budgetExceeded: false };
  if (!characters.active) return empty;

  const bookIds = [...new Set([
    ...settings.globalLorebooks,
    ...characters.active.lorebook_ids,
  ])];
  if (bookIds.length === 0) return empty;

  const rawEntries = await lorebooks.resolveEntries(bookIds);
  const entries = rawEntries.map(adaptEntry);

  // Scan text = last N messages (default scan_depth = 4 across most books;
  // we use the max of the active books).
  const books = bookIds.map((id) => lorebooks.list.find((b) => b.id === id)).filter(Boolean);
  const scanDepth = Math.max(4, ...books.map((b) => b!.scan_depth));
  const budget = Math.max(...books.map((b) => b!.token_budget), 2048);
  const recursive = books.some((b) => b!.recursive);

  const visible = messages.filter((m) => !m.is_hidden);
  // Skip the last bot msg on swipe/regen — it's being replaced.
  const cutoff = (type === 'swipe' || type === 'regenerate') && visible.at(-1)?.role === 'assistant'
    ? visible.length - 1
    : visible.length;
  const scanText = visible.slice(Math.max(0, cutoff - scanDepth), cutoff)
    .map((m) => m.content).join('\n\n');

  // Pre-expand macros in entry content (lore can use {{user}}/{{char}}).
  const env = buildEnv(type);
  const expanded = entries.map((e) => ({ ...e, content: evaluateMacros(e.content, env) }));

  return scanLorebook(expanded, {
    scanText,
    recursive,
    maxRecursionSteps: 0,
    budget,
    caseSensitive: false,
    matchWholeWords: false,
    chatIdHash: stringHash(active!.id),
  });
}

function buildAuthorsNote(meta: ChatMetadata) {
  const text = meta.note_prompt?.trim();
  if (!text) return null;
  return {
    content: text,
    depth: meta.note_depth ?? 4,
    role: meta.note_role ?? 'system',
  };
}

function buildEnv(type: GenerationType): MacroEnv {
  const visible = messages.filter((m) => !m.is_hidden);
  let lastUser = '', lastChar = '';
  for (let i = visible.length - 1; i >= 0; i--) {
    const m = visible[i]!;
    if (!lastUser && m.role === 'user') lastUser = m.content;
    if (!lastChar && m.role === 'assistant') lastChar = m.content;
    if (lastUser && lastChar) break;
  }
  return {
    user: personas.active?.name ?? 'User',
    char: characters.active?.data.name ?? '',
    persona: personas.active?.description ?? '',
    description: characters.active?.data.description ?? '',
    personality: characters.active?.data.personality ?? '',
    scenario: active?.metadata.scenario ?? characters.active?.data.scenario ?? '',
    model: connections.active?.model ?? '',
    chatVars: (active?.metadata.variables as Record<string, string>) ?? {},
    globalVars: {},
    messageCount: visible.length,
    lastMessage: visible.at(-1)?.content ?? '',
    lastUserMessage: lastUser,
    lastCharMessage: lastChar,
    generationType: type,
    chatIdHash: stringHash(active?.id ?? ''),
  };
}

// ── Slash commands (minimal subset) ──────────────────────────────────────────

async function runSlashCommand(input: string): Promise<void> {
  const [cmd, ...rest] = input.slice(1).split(' ');
  const arg = rest.join(' ');

  switch (cmd?.toLowerCase()) {
    case 'sys':
    case 'system': {
      if (!active) return;
      if (isPending) await materializePending();
      if (!active) return;
      const m = await api.messages.create(active.id, { role: 'system', content: arg });
      messages = [...messages, m];
      return;
    }
    case 'continue':
    case 'cont':
      await chat.generate('continue');
      return;
    case 'regenerate':
    case 'regen':
      await chat.generate('regenerate');
      return;
    case 'cut':
    case 'del': {
      const last = messages.at(-1);
      if (last) await chat.deleteMessage(last.id);
      return;
    }
    case 'hide': {
      const idx = Number(arg);
      const m = messages[idx];
      if (m) await chat.hideMessage(m.id, true);
      return;
    }
    default:
      toasts.warning(`Unknown command: /${cmd}`);
  }
}
