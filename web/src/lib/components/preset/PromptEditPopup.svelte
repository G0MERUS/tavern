<!--
  Modal prompt editor. ST renders this as a full-height drawer that slides over
  the panel; we use a centered popup — the prompt textarea wants width.

  State pattern: local draft. Clone on open, edit draft, write back on Save.
  ST does this (no live binding into the pool). The store is module-level so
  PromptManager and QuickEdit can both poke it.

  Triggers multi-select: six checkboxes in a row. ST uses select2; we don't
  have one and nobody actually uses triggers.
-->
<script module lang="ts">
  import type { PromptDefinition } from '$lib/api/types';

  let draft = $state<PromptDefinition | null>(null);

  export const promptEditor = {
    get draft() { return draft; },
    open(p: PromptDefinition) { draft = { ...p, injection_trigger: [...p.injection_trigger] }; },
    close() { draft = null; },
  };
</script>

<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import Input from '../ui/Input.svelte';
  import Select from '../ui/Select.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import Button from '../ui/Button.svelte';
  import { preset } from '$lib/state/preset.svelte';
  import {
    PROMPT_SOURCES,
    DEFAULT_PROMPTS,
    canForbidOverride,
    canReset,
  } from '$lib/core/preset-defaults';
  import type { GenerationType } from '$lib/api/types';

  const TRIGGERS: { value: GenerationType; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'continue', label: 'Continue' },
    { value: 'impersonate', label: 'Impersonate' },
    { value: 'swipe', label: 'Swipe' },
    { value: 'regenerate', label: 'Regenerate' },
    { value: 'quiet', label: 'Quiet' },
  ];

  const isMarkerWithSource = $derived(draft && draft.identifier in PROMPT_SOURCES);
  const showForbidOverride = $derived(draft && canForbidOverride(draft));
  const showReset = $derived(draft && canReset(draft));
  const isAbsolute = $derived(draft?.injection_position === 1);

  function save() {
    if (!draft) return;
    preset.upsertPrompt(draft);
    promptEditor.close();
  }

  /** Pull from DEFAULT_PROMPTS. Updates draft only — user still hits Save. */
  function reset() {
    if (!draft) return;
    const def = DEFAULT_PROMPTS.find((p) => p.identifier === draft!.identifier);
    if (!def) return;
    draft.name = def.name;
    draft.role = def.role;
    draft.content = def.content;
    draft.forbid_overrides = def.forbid_overrides;
  }

  function toggleTrigger(t: GenerationType) {
    if (!draft) return;
    if (draft.injection_trigger.includes(t)) {
      draft.injection_trigger = draft.injection_trigger.filter((x) => x !== t);
    } else {
      draft.injection_trigger = [...draft.injection_trigger, t];
    }
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') promptEditor.close();
  }
</script>

{#if draft}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-9000 bg-black/60 flex items-center justify-center p-4"
    transition:fade={{ duration: 100 }}
    onkeydown={onkey}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div
      class="panel-chrome backdrop-blur-md p-4 w-full max-w-2xl max-h-[90vh] flex flex-col gap-3 overflow-y-auto"
      transition:scale={{ start: 0.95, duration: 100 }}
    >
      <h3 class="font-bold text-lg m-0">
        {draft.name || 'New Prompt'}
      </h3>

      <!-- ── Row 1: Name · Role · Triggers ───────────────────────────────── -->
      <div class="flex gap-2 items-end flex-wrap">
        <label class="flex flex-col gap-1 flex-1 min-w-40">
          <span class="text-xs opacity-70">Name</span>
          <Input bind:value={draft.name} placeholder="Prompt name" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs opacity-70">Role</span>
          <Select
            bind:value={draft.role}
            options={[
              { value: 'system', label: 'System' },
              { value: 'user', label: 'User' },
              { value: 'assistant', label: 'Assistant' },
            ]}
          />
        </label>
      </div>

      <!-- Triggers: 6 checkboxes -->
      <div class="flex flex-col gap-1">
        <span class="text-xs opacity-70">Triggers <span class="opacity-50">(empty = all)</span></span>
        <div class="flex gap-3 flex-wrap text-xs">
          {#each TRIGGERS as t (t.value)}
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" class="accent-quote"
                checked={draft.injection_trigger.includes(t.value)}
                onchange={() => toggleTrigger(t.value)} />
              {t.label}
            </label>
          {/each}
        </div>
      </div>

      <!-- ── Row 2: Position · Depth · Order ─────────────────────────────── -->
      <div class="flex gap-2 items-end">
        <label class="flex flex-col gap-1 flex-1">
          <span class="text-xs opacity-70">Position</span>
          <Select
            value={String(draft.injection_position)}
            options={[
              { value: '0', label: 'Relative' },
              { value: '1', label: 'In-chat' },
            ]}
            onchange={(v) => { if (draft) draft.injection_position = v === '1' ? 1 : 0; }}
          />
        </label>
        {#if isAbsolute}
          <label class="flex flex-col gap-1 w-20">
            <span class="text-xs opacity-70">Depth</span>
            <input type="number" class="text-pole" min="0"
              bind:value={draft.injection_depth} />
          </label>
          <label class="flex flex-col gap-1 w-20">
            <span class="text-xs opacity-70">Order</span>
            <input type="number" class="text-pole" min="0"
              bind:value={draft.injection_order} />
          </label>
        {/if}
      </div>

      <!-- ── Row 3: Prompt label + forbid_overrides ──────────────────────── -->
      <div class="flex justify-between items-center">
        <span class="text-sm opacity-80">Prompt</span>
        {#if showForbidOverride}
          <label class="flex items-center gap-1 text-xs cursor-pointer">
            <input type="checkbox" class="accent-quote"
              bind:checked={draft.forbid_overrides} />
            Forbid Overrides
          </label>
        {/if}
      </div>

      <!-- ── Row 4–5: Source hint OR content textarea ────────────────────── -->
      <!-- ST hides the disabled textarea entirely and shows the hint in its
           place. Markers don't have editable content. -->
      {#if isMarkerWithSource}
        <p class="text-sm opacity-60 p-3 border border-st-border rounded">
          Source: <strong>{PROMPT_SOURCES[draft.identifier]}</strong>.
          The content is pulled from elsewhere and cannot be edited here.
        </p>
      {:else if draft.marker}
        <p class="text-sm opacity-60 p-3 border border-st-border rounded">
          This is a structural marker. Content is generated at runtime.
        </p>
      {:else}
        <Textarea bind:value={draft.content} rows={10} sizeKey="prompt.content" class="min-h-50" />
      {/if}

      <!-- ── Footer ──────────────────────────────────────────────────────── -->
      <div class="flex justify-end gap-2 mt-2">
        <Button onclick={() => promptEditor.close()}>
          <span class="i-fa6-solid:xmark mr-1"></span> Close
        </Button>
        {#if showReset}
          <Button onclick={reset} class="!text-golden">
            <span class="i-fa6-solid:clock-rotate-left mr-1"></span> Reset
          </Button>
        {/if}
        <Button variant="primary" onclick={save}>
          <span class="i-fa6-solid:floppy-disk mr-1"></span> Save
        </Button>
      </div>
    </div>
  </div>
{/if}
