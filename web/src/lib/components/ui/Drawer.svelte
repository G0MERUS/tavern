<!--
  Drawer shell. left/right slide from edge; center fades from above.
  z-ladder: 3500 sides, 4000 center, 3999 backdrop.

  Side drawers get a drag-to-resize edge grip. Width resolution:
    1. settings.panelSizes[id] (user dragged) → ${n}px
    2. var(--drawer-side-default) clamp() fallback
  Double-click the grip to clear (1) and fall back to (2).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { resize } from '$lib/actions/resize';
  import { settings } from '$lib/state/settings.svelte';
  import { viewport } from '$lib/state/ui.svelte';

  interface Props {
    open: boolean;
    side: 'left' | 'right' | 'center';
    /** Persistence key for width. Required for resize to persist. */
    id?: string;
    /** Allow drag-to-resize. Default true for sides, false for center. */
    resizable?: boolean;
    title?: string;
    onclose?: () => void;
    children?: Snippet;
    actions?: Snippet;
  }

  let {
    open,
    side,
    id,
    resizable = side !== 'center',
    title,
    onclose,
    children,
    actions,
  }: Props = $props();

  const flyParams = $derived(
    side === 'left'  ? { x: -300, duration: 200 } :
    side === 'right' ? { x:  300, duration: 200 } :
                       { y:  -20, duration: 150 }
  );

  // Static positioning per side. Sides drop the hardcoded clamp — width is now
  // an inline style so the persisted size can win.
  const layout = {
    left:   'left-0 bottom-0 border-r rounded-none z-3500',
    right:  'right-0 bottom-0 border-l rounded-none z-3500',
    // Center stays clamped — "open, do one thing, close". The popup overlays
    // (CharAdvanced etc) get the action directly when they want width.
    center: 'left-1/2 -translate-x-1/2 max-h-[80vh] w-[clamp(min(95vw,500px),50vw,800px)] rounded-t-none z-4000',
  };

  // Live width during drag. Initialized from persisted size each time the
  // drawer mounts (the {#if open} block remounts on every open).
  // svelte-ignore state_referenced_locally
  const stored = id ? settings.panelSizes[id] : undefined;
  // svelte-ignore state_referenced_locally
  let width = $state<number | null>(typeof stored === 'number' ? stored : null);

  const canResize = $derived(resizable && side !== 'center' && !viewport.isMobile);
</script>

{#if open}
  {#if side === 'center'}
    <button
      class="fixed inset-0 z-3999 bg-black/40"
      transition:fade={{ duration: 150 }}
      onclick={onclose}
      aria-label="Close"
    ></button>
  {/if}

  {#snippet body()}
    {#if title || actions || onclose}
      <header class="flex items-center justify-between gap-2 px-3 py-2 border-b border-st-border">
        {#if title}<h3 class="font-bold text-base m-0">{title}</h3>{/if}
        <div class="flex items-center gap-1">
          {@render actions?.()}
          {#if onclose}
            <button
              class="right-menu-btn i-fa6-solid:xmark w-4 h-4"
              onclick={onclose}
              aria-label="Close"
            ></button>
          {/if}
        </div>
      </header>
    {/if}
    <div class="flex-1 overflow-y-auto p-3">
      {@render children?.()}
    </div>
  {/snippet}

  {#if canResize}
    <aside
      class="panel-chrome fixed top-9 flex flex-col backdrop-blur-[var(--SmartThemeBlurStrength)] {layout[side]}"
      style:width={width ? `${width}px` : 'var(--drawer-side-default)'}
      use:resize={{
        axis: 'x',
        edge: side === 'right' ? 'left' : 'right',
        key: id,
        min: 280,
        max: window.innerWidth * 0.5,
        onresize: (w) => { width = w || null; },
      }}
      transition:fly={flyParams}
    >
      {@render body()}
    </aside>
  {:else}
    <aside
      class="panel-chrome fixed top-9 flex flex-col backdrop-blur-[var(--SmartThemeBlurStrength)] {layout[side]}"
      style:width={side === 'center' ? undefined : 'var(--drawer-side-default)'}
      transition:fly={flyParams}
    >
      {@render body()}
    </aside>
  {/if}
{/if}
