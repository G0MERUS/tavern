<!--
  The .mes bubble — two-column layout pixel-faithful to ST's #message_template.

    ┌─.mes (flex row, padding 10px 10px 0)──────────────────────────┐
    │ ┌──────┐ ┌─.mes_block (flex-1)───────────────────────────────┐│
    │ │avatar│ │ name 👻 timestamp model               […][✎]      ││ ← buttons RIGHT,
    │ └──────┘ │ ▸ Thought for 2.4s                                ││   always visible
    │   #42    │ ┌─.mes_text──────────────────────────────────────┐ ││
    │   3.2s   │ │ *narration…* "dialogue"                       │ ││
    │  ~150t   │ └────────────────────────────────────────────────┘ ││
    │          │                                      ◀  1/3  ▶  ││ ← abs r:0 b:0
    │          └───────────────────────────────────────────────────┘│
    └───────────────────────────────────────────────────────────────┘

  .mes_text (underscore) is the scopeCSS() target — ST's user themes target
  this name; the underscore is the compat-correct choice. Avatar-column meta
  (id/timer/tokens) moved out of the header so a long character name + model
  string don't fight a 12px counter for one line.
-->
<script lang="ts">
  import dayjs from 'dayjs';
  import type { Message } from '$lib/api/types';
  import { renderMessage } from '$lib/core/markdown';
  import { chat } from '$lib/state/chat.svelte';
  import { characters } from '$lib/state/characters.svelte';
  import { personas } from '$lib/state/personas.svelte';
  import { settings } from '$lib/state/settings.svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { estimateTokens } from '$lib/core/tokenize';
  import Textarea from '../ui/Textarea.svelte';
  import MessageButtons from './MessageButtons.svelte';
  import MessageEditButtons from './MessageEditButtons.svelte';
  import SwipeControls from './SwipeControls.svelte';

  interface Props {
    message: Message;
    index?: number;
    isLast?: boolean;
  }

  let { message, index = 0, isLast = false }: Props = $props();

  const T = $derived(theme.toggles);

  let editing = $state(false);
  let editText = $state('');

  // ── Identity ──────────────────────────────────────────────────────────────
  const isUser = $derived(message.role === 'user');
  const isSystem = $derived(message.role === 'system');

  const name = $derived(
    isSystem ? 'System' :
    isUser ? (personas.active?.name ?? 'User') :
    (characters.active?.data.name ?? 'Assistant')
  );

  const avatar = $derived(
    isUser ? personas.active?.thumbnail_url :
    isSystem ? null :
    characters.active?.thumbnail_url
  );

  // Greeting = first message of an untainted chat. Suppresses the .last-swipe
  // glow on the right chevron (looping to #0, not generating).
  const isGreeting = $derived(
    !chat.active?.metadata.tainted && index === 0 && message.role === 'assistant'
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const rendered = $derived(
    settings.renderMarkdown ? renderMessage(message.content) : escapeHtml(message.content)
  );

  // gen_timer dropped the isLast gate — ST shows it on every message that has
  // one. It's a stat, not a live indicator.
  const genSeconds = $derived.by(() => {
    const e = message.extra;
    if (typeof e.gen_finished_at !== 'number' || typeof e.gen_started_at !== 'number') return null;
    return ((e.gen_finished_at - e.gen_started_at) / 1000).toFixed(1);
  });

  // Real count from the API response wins; estimate is the fallback.
  const tokens = $derived(message.extra.token_count ?? estimateTokens(message.content));

  // The avatar column collapses when there's nothing in it. hide_avatars hides
  // ONLY the image — meta items stay (ST's behavior).
  const hasMeta = $derived(T.message_ids || (T.gen_timer && genSeconds) || T.token_count);
  const showAvatarColumn = $derived(!T.hide_avatars || hasMeta);

  // ── Actions ───────────────────────────────────────────────────────────────
  function startEdit(): void {
    editText = message.content;
    editing = true;
  }

  async function saveEdit(): Promise<void> {
    if (editText !== message.content) {
      await chat.patchMessage(message.id, { content: editText });
    }
    editing = false;
  }

  function escapeHtml(s: string): string {
    const map: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    };
    return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
  }
</script>

<article
  class="mes group relative flex items-start"
  class:last_mes={isLast}
  class:bg-user-mes={isUser}
  class:bg-bot-mes={!isUser && !isSystem}
  style:background-color={isSystem ? 'rgba(0,0,0,0.2)' : undefined}
  data-role={message.role}
  data-hidden={message.is_hidden ? '' : undefined}
>
  <!-- ── Delete-mode checkbox ───────────────────────────────────────────────
       Rendered above the bubble in delete mode. app.css's :has(.delete-banner)
       guard hides hover/edit/swipe affordances bubble-wide so only this
       checkbox is interactive. -->
  {#if chat.deleteMode}
    <label class="mes-delete-check absolute top-2 left-2 z-10 cursor-pointer">
      <input type="checkbox"
        checked={chat.deleteSelection.has(message.id)}
        onchange={() => chat.toggleSelected(message.id)} />
    </label>
  {/if}

  <!-- ── Avatar column ─────────────────────────────────────────────────────
       The left rail. Width is the avatar's; meta stacks below where there's
       vertical space to burn (50px avatar + three 12px lines is still
       shorter than the average message body). cursor:pointer is a hint —
       avatar zoom popup is out of scope but the affordance is here. -->
  {#if showAvatarColumn}
    <div class="mesAvatarWrapper flex flex-col items-center gap-1 flex-shrink-0">
      {#if !T.hide_avatars}
        {#if avatar}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <img src={avatar} alt={name}
            class="avatar object-cover cursor-pointer
                   w-[var(--avatar-base-width)] h-[var(--avatar-base-height)]
                   rounded-[var(--avatar-base-border-radius)]" />
        {:else}
          <div class="avatar bg-black/30 flex items-center justify-center
                      w-[var(--avatar-base-width)] h-[var(--avatar-base-height)]
                      rounded-[var(--avatar-base-border-radius)]">
            <span class="opacity-50"
              class:i-fa6-solid:gear={isSystem}
              class:i-fa6-solid:user={!isSystem}></span>
          </div>
        {/if}
      {/if}

      {#if T.message_ids}
        <span class="mes-meta">#{index}</span>
      {/if}
      {#if T.gen_timer && genSeconds}
        <span class="mes-meta">{genSeconds}s</span>
      {/if}
      {#if T.token_count}
        <span class="mes-meta">~{tokens}t</span>
      {/if}
    </div>
  {/if}

  <!-- ── Message block ───────────────────────────────────────────────────
       relative: swipe controls anchor here, not on .mes. The bottom
       padding (assistant only, app.css) reserves a 25px strip for the
       ‹ 1/3 › group at right:0 b:0.

       self-stretch: override the parent's items-start so mes_block always
       fills the row height. On an *empty* assistant message the block's
       natural height (header + 10px body padding + 30px swipe strip ≈
       62px) is shorter than the avatar column (50px round, 90px
       rectangle). Without stretching, the absolutely-positioned swipe
       group sits at bottom:5px of that short box — floating mid-bubble
       with dead space below it. Stretching pins the strip to the actual
       bubble bottom. -->
  <div class="mes_block relative flex-1 min-w-0 pl-2.5 self-stretch">
    <!-- Header. min-h keeps the row from collapsing on system messages
         (no buttons). items-baseline so name + timestamp share a baseline
         despite different font sizes. The button strips swap in place —
         in-place transformation, not a separate edit-mode component. -->
    <div class="ch_name flex items-baseline justify-between gap-2 min-h-[22px]">
      <div class="flex items-baseline gap-2 min-w-0">
        <span class="name_text font-bold truncate">{name}</span>
        {#if message.is_hidden}
          <span class="i-fa6-solid:ghost text-xs opacity-70 flex-shrink-0"
                title="Hidden from the AI"></span>
        {/if}
        {#if T.timestamps}
          <small class="timestamp opacity-70 whitespace-nowrap">
            {dayjs(message.created_at).format('LL LT')}
          </small>
        {/if}
        {#if T.model_icon && message.extra.model}
          <small class="opacity-50 truncate">{message.extra.model}</small>
        {/if}
      </div>

      {#if !isSystem}
        {#if editing}
          <MessageEditButtons {message} {index} {isLast}
            onsave={saveEdit} oncancel={() => editing = false} />
        {:else}
          <MessageButtons {message} {index} {isLast} onedit={startEdit} />
        {/if}
      {/if}
    </div>

    <!-- Reasoning. Stays above .mes_text; gets the same right gutter so it
         aligns with the body. -->
    {#if message.extra.reasoning != null}
      <details class="mes_reasoning_details text-xs opacity-60 mt-1">
        <summary class="cursor-pointer select-none">
          ▸ Thought
          {#if message.extra.reasoning_duration}
            for {(message.extra.reasoning_duration / 1000).toFixed(1)}s
          {/if}
        </summary>
        <pre class="mes_reasoning whitespace-pre-wrap font-mono mt-1">{message.extra.reasoning}</pre>
      </details>
    {/if}

    <!-- Body. The textarea sits in the same slot — header stays, only the
         body content swaps. Gutter is on a wrapper, not the textarea: putting
         padding-right INSIDE a text input just shoves the caret left of an
         invisible margin. text-pole doesn't ship w-full; explicit here. -->
    {#if editing}
      <div class="pt-[5px] pr-[var(--mes-right-spacing)]">
        <Textarea bind:value={editText} maxHeight={400} class="w-full" />
      </div>
    {:else}
      <div class="mes_text prose prose-sm max-w-none">
        {@html rendered}
      </div>
    {/if}

    {#if !isUser && !isSystem}
      <SwipeControls {message} {isGreeting} />
    {/if}
  </div>
</article>
