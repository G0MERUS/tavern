<!--
  ▸ Custom CSS ──────────────────────── [⛶]
    [textarea, font-mono, maxHeight=300]

  [⛶] pops a near-fullscreen editor (inset-4). The textarea is the whole body.
  No syntax highlighting — that's a CodeMirror-sized dep for a feature most
  users never open. If someone asks, it's a contained add later.

  Sanitization (strip @import etc) happens in the cascade $effect, not here.
  Typing fires the <style> injection on every keystroke (local, costs nothing)
  but the PATCH is debounced by markDirty().
-->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import InlineDrawer from '../ui/InlineDrawer.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import { theme } from '$lib/state/theme.svelte';

  let maximized = $state(false);
</script>

<InlineDrawer title="Custom CSS" key="theme.css">
  {#snippet actions()}
    <IconButton icon="up-right-and-down-left-from-center" size="sm"
      title="Maximize" onclick={() => maximized = true} />
  {/snippet}

  <Textarea
    bind:value={theme.active.custom_css}
    maxHeight={300}
    sizeKey="theme.css"
    rows={4}
    class="font-mono text-xs"
    placeholder="/* button {'{'} background: red {'}'} */"
    oninput={theme.markDirty}
  />
</InlineDrawer>

{#if maximized}
  <div class="fixed inset-4 z-9000 panel-chrome flex flex-col" transition:fade={{ duration: 100 }}>
    <header class="flex justify-between items-center p-2 border-b border-st-border">
      <span class="font-bold">Custom CSS</span>
      <IconButton icon="xmark" size="sm" title="Close" onclick={() => maximized = false} />
    </header>
    <textarea
      bind:value={theme.active.custom_css}
      oninput={theme.markDirty}
      class="flex-1 p-3 font-mono text-sm bg-black/30 text-body resize-none focus:outline-none"
      spellcheck="false"
    ></textarea>
  </div>
{/if}
