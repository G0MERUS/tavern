<!--
  Auto-growing textarea. Reset height → read scrollHeight → set height.

  Coexists with native resize: the action installs el.__resize.setSize(),
  which goes inert once the user drags the corner. Without that lockout,
  auto-grow snaps you back on the next keystroke. Double-click the corner
  to unlock. resizable={false} for the rare textarea that wants neither.
-->
<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import { resize } from '$lib/actions/resize';

  interface Props extends Omit<HTMLTextareaAttributes, 'value'> {
    value?: string;
    /** Cap growth (px). 0 = unlimited. */
    maxHeight?: number;
    /** Persist user-dragged height under this key. Most callers don't. */
    sizeKey?: string;
    /** Allow native resize handle. Default true. */
    resizable?: boolean;
  }

  let {
    value = $bindable(''),
    maxHeight = 0,
    sizeKey,
    resizable = true,
    rows = 3,
    class: cls = '',
    ...rest
  }: Props = $props();

  let el: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    value;  // dependency tracking
    if (!el) return;
    const ctrl = el.__resize;
    if (ctrl) {
      // The reset-measure-set dance lives inside the controller so it can
      // suppress its own ResizeObserver. Doing it here would self-lock.
      ctrl.autosize(maxHeight);
    } else {
      // resizable={false}: no observer, no lockout, the old loop is fine.
      el.style.height = 'auto';
      const target = el.scrollHeight + 2;
      el.style.height = `${maxHeight > 0 ? Math.min(target, maxHeight) : target}px`;
    }
  });
</script>

{#if resizable}
  <textarea
    bind:this={el}
    bind:value
    {rows}
    use:resize={{ axis: 'y', key: sizeKey }}
    class="text-pole overflow-y-auto {cls}"
    {...rest}
  ></textarea>
{:else}
  <textarea
    bind:this={el}
    bind:value
    {rows}
    class="text-pole resize-none overflow-y-auto {cls}"
    {...rest}
  ></textarea>
{/if}
