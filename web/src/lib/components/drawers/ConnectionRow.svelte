<!--
  One row in the connection list. Click row = activate, pencil = edit,
  trash = delete (confirmed). Replaces the active-connection <Select>.

  kindIcon: tiny grey glyph, only for non-'openai' kinds. Conveys "this one
  talks native" without a label. 'openai' is the default, doesn't need a marker.
-->
<script lang="ts">
  import IconButton from '../ui/IconButton.svelte';
  import type { Connection } from '$lib/api/types';

  interface Props {
    c: Connection;
    active: boolean;
    onedit: (id: string) => void;
    ondelete: (id: string) => void;
    onselect: (id: string) => void;
  }

  let { c, active, onedit, ondelete, onselect }: Props = $props();

  // 'openai' → '', 'anthropic' → 'A', 'google' → 'G'
  const kindGlyph = $derived(c.kind === 'anthropic' ? 'A' : c.kind === 'google' ? 'G' : '');
</script>

<div
  role="button"
  tabindex="0"
  class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
         border-l-2 transition-colors hover:bg-white/5"
  class:border-l-quote={active}
  class:border-l-transparent={!active}
  onclick={() => onselect(c.id)}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onselect(c.id); } }}
>
  <span
    class="w-2 h-2 rounded-full flex-shrink-0
           {active ? 'bg-active' : 'border border-white/30'}"
  ></span>

  <span class="flex-1 truncate text-sm" class:opacity-60={!active}>
    {c.label}
  </span>

  <span class="text-xs opacity-50 truncate max-w-[40%]">{c.model}</span>

  {#if kindGlyph}
    <span class="text-xs opacity-40 font-mono w-3 text-center" title="Native {c.kind}">
      {kindGlyph}
    </span>
  {/if}

  <IconButton icon="pencil" size="sm" title="Edit"
    onclick={(e) => { e.stopPropagation(); onedit(c.id); }} />
  <IconButton icon="trash" size="sm" title="Delete"
    onclick={(e) => { e.stopPropagation(); ondelete(c.id); }} />
</div>
