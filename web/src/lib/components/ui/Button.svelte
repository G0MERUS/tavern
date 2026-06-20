<!--
  Base button. `menu-btn` shortcut bakes in hover/active/disabled via variant
  groups: `hover:(brightness-125 grayscale-0) active:scale-95 disabled:(...)`.
  Variants bolt on overrides with `!` to win specificity.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'default' | 'primary' | 'danger' | 'ghost';
    children?: Snippet;
  }

  let { variant = 'default', children, class: cls = '', ...rest }: Props = $props();

  const tints = {
    default: '',
    primary: '!border-quote !text-quote',
    danger: '!border-crimson !text-red-400',
    ghost: '!border-transparent !bg-transparent',
  };
</script>

<button type="button" class="menu-btn {tints[variant]} {cls}" {...rest}>
  {@render children?.()}
</button>
