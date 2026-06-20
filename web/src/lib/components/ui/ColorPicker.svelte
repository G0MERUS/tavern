<!--
  Native <input type="color"> for hue/sat/lightness + our Slider for alpha.
  The native input doesn't do alpha, so the swatch popover composes both.

  Format is always rgba(), even at a=1. ST themes in the wild use both rgb()
  and rgba(); we normalize on parse and never look back.

  ~50 LOC, no dep. vanilla-colorful is 8KB; this is one slider's worth of work.
-->
<script lang="ts">
  import Slider from './Slider.svelte';
  import { val } from '$lib/utils/dom';

  interface Props {
    /** rgba(r, g, b, a) string. Bindable. */
    value?: string;
    label: string;
    /** Reset target. */
    defaultValue?: string;
    onchange?: (rgba: string) => void;
  }

  let { value = $bindable('rgba(0, 0, 0, 1)'), label, defaultValue, onchange }: Props = $props();

  let open = $state(false);
  let root: HTMLElement | undefined = $state();

  // Loose enough to take rgb(), rgba(), space- or comma-delimited.
  function parse(s: string): [number, number, number, number] {
    const m = s.match(/(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?/);
    return m ? [+m[1]!, +m[2]!, +m[3]!, m[4] !== undefined ? +m[4]! : 1] : [0, 0, 0, 1];
  }

  function pack(r: number, g: number, b: number, a: number): string {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  const [r, g, b, a] = $derived(parse(value));

  const hex = $derived(
    '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
  );

  function setHex(h: string): void {
    const nr = parseInt(h.slice(1, 3), 16);
    const ng = parseInt(h.slice(3, 5), 16);
    const nb = parseInt(h.slice(5, 7), 16);
    value = pack(nr, ng, nb, a);
    onchange?.(value);
  }

  function setAlpha(na: number): void {
    value = pack(r, g, b, na);
    onchange?.(value);
  }

  function reset(): void {
    if (defaultValue) {
      value = defaultValue;
      onchange?.(value);
    }
  }

  // Outside-click closes — same pattern as Combobox.
  $effect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  });
</script>

<div bind:this={root} class="flex items-center justify-between gap-2 relative">
  <span class="text-sm opacity-80">{label}</span>
  <div class="flex items-center gap-2">
    <span class="text-xs opacity-40 font-mono">{value}</span>
    <button
      type="button"
      class="w-6 h-6 rounded border border-st-border cursor-pointer relative
             bg-[linear-gradient(45deg,#888_25%,transparent_25%,transparent_75%,#888_75%),linear-gradient(45deg,#888_25%,#444_25%,#444_75%,#888_75%)]
             bg-[length:8px_8px] bg-[position:0_0,4px_4px]"
      onclick={() => open = !open}
      aria-label="Pick {label}"
    >
      <span class="absolute inset-0 rounded" style:background={value}></span>
    </button>
  </div>

  {#if open}
    <div class="panel-chrome absolute right-0 top-full mt-1 z-20 p-3 w-52 flex flex-col gap-2 shadow-lg">
      <input
        type="color"
        value={hex}
        oninput={(e) => setHex(val(e))}
        class="w-full h-32 rounded cursor-pointer border border-st-border"
      />
      <Slider label="Alpha" value={a} min={0} max={1} step={0.01} onchange={setAlpha} />
      {#if defaultValue}
        <button class="menu-btn text-xs" onclick={reset}>Reset</button>
      {/if}
    </div>
  {/if}
</div>
