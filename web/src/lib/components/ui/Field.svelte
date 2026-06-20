<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    hint?: string;
    /** Right-aligned token estimate ("123t"). Glance-before-typing, not after. */
    tokens?: number;
    inline?: boolean;
    children?: Snippet;
  }

  let { label, hint, tokens, inline = false, children }: Props = $props();
</script>

<!-- The control is the snippet, so it nests INSIDE <label>. Click-on-label
     focuses the input, screen readers associate them. The spec allows
     a label to wrap its control instead of using `for`/`id`. -->
<label class="flex gap-1" class:flex-col={!inline} class:items-center={inline} class:justify-between={inline}>
  <span class="flex items-baseline justify-between text-sm opacity-80 select-none">
    <span>
      {label}
      {#if hint}<span class="text-xs opacity-50 ml-1">— {hint}</span>{/if}
    </span>
    {#if tokens !== undefined}
      <span class="text-xs opacity-40">{tokens}t</span>
    {/if}
  </span>
  {@render children?.()}
</label>
