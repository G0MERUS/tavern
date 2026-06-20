<!--
  Square icon button. Composes `menu-btn-icon` (which composes `menu-btn`).
-->
<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    /** Icon name without prefix: 'trash', 'star', 'pencil'. */
    icon: string;
    weight?: 'solid' | 'regular';
    /** Highlighted — orange tint. */
    active?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }

  let {
    icon,
    weight = 'solid',
    active = false,
    size = 'md',
    class: cls = '',
    title,
    ...rest
  }: Props = $props();

  const sizeCls = { sm: 'min-w-[1.5em] text-xs', md: 'min-w-[2em] text-sm', lg: 'min-w-[2.5em] text-base' };
</script>

<button
  type="button"
  class="menu-btn-icon {sizeCls[size]} {cls}"
  class:!text-quote={active}
  {title}
  aria-label={title}
  {...rest}
>
  <span class="i-fa6-{weight}:{icon} inline-block"></span>
</button>
