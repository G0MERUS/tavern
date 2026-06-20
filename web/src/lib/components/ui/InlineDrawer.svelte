<!--
  Collapsible section. The chevron-down-rotates pattern from ST's left panel.
  Body is just an `{#if open}` — ST doesn't animate these and neither do we.

  When `key` is provided, collapse state persists to settings.collapsedSections
  across reloads. Without `key`, state is local to the component.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useCollapsed } from '$lib/state/settings.svelte';

  interface Props {
    title: string;
    /** Smaller grey text under the title — the "(Default)" / "(Space)" hints. */
    subtitle?: string;
    /** Tooltip on a circle-info icon next to the title. */
    info?: string;
    /** Persistence key. If set, open/closed survives reload. */
    key?: string;
    /** Default open state when no `key` (or before settings load). */
    defaultOpen?: boolean;
    /** Right-aligned icon buttons in the header (don't toggle on click). */
    actions?: Snippet;
    children?: Snippet;
  }

  let { title, subtitle, info, key, defaultOpen = false, actions, children }: Props = $props();

  // Persisted mode: derive from settings. Local mode: own $state.
  // The `key` capture is intentional — persistence binding is set at
  // construction time and never changes (the section's identity is static).
  // svelte-ignore state_referenced_locally
  const persisted = key ? useCollapsed(key) : null;
  // svelte-ignore state_referenced_locally
  let localOpen = $state(defaultOpen);

  const open = $derived(persisted ? !persisted.get() : localOpen);

  function toggle() {
    if (persisted) persisted.set(open);  // open=true → set collapsed=true
    else localOpen = !localOpen;
  }
</script>

<div class="flex flex-col">
  <button type="button" class="inline-drawer-toggle text-left" onclick={toggle}>
    <span class="flex items-center gap-1.5 min-w-0">
      <span class="font-bold truncate">{title}</span>
      {#if info}
        <span class="i-fa6-solid:circle-info text-xs opacity-50" title={info}></span>
      {/if}
      {#if subtitle}
        <span class="text-xs opacity-50 truncate">({subtitle})</span>
      {/if}
    </span>
    <span class="flex items-center gap-1">
      {#if actions}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span onclick={(e) => e.stopPropagation()}>{@render actions()}</span>
      {/if}
      <span
        class="i-fa6-solid:circle-chevron-down text-sm opacity-50 transition-transform"
        class:rotate-180={open}
      ></span>
    </span>
  </button>
  {#if open}
    <div class="flex flex-col gap-2 pt-1 pb-2">
      {@render children?.()}
    </div>
  {/if}
</div>
