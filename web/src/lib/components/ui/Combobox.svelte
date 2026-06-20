<!--
  Searchable input + listbox. Free text is always valid — the catalog is
  autocomplete, not an enum. The backend doesn't validate model ids; the
  upstream does.

  Can't fake this with <select> (need free text) or <input>+<datalist>
  (browsers render value-only, no room for "200K · $5/Mtok" meta).
-->
<script module lang="ts">
  export interface ComboOption {
    /** What goes in the input. */
    value: string;
    /** Primary text in the row. */
    label: string;
    /** Grey text on the right ("200K · $5/M"). */
    meta?: string;
    /** Optional pill ("👁🧠"). */
    badge?: string;
  }
</script>

<script lang="ts">
  import { tick } from 'svelte';

  interface Props {
    value?: string;
    options: ComboOption[];
    placeholder?: string;
    onpick?: (opt: ComboOption) => void;
  }

  let { value = $bindable(''), options, placeholder, onpick }: Props = $props();

  // crypto.randomUUID is fine here — we just need DOM-unique, not secure.
  const listboxId = `cb-${crypto.randomUUID().slice(0, 8)}`;

  let open = $state(false);
  let highlight = $state(0);
  let root: HTMLElement | undefined = $state();
  let input: HTMLInputElement | undefined = $state();
  let listbox: HTMLElement | undefined = $state();

  // Filter on both value and label. So `opus` matches "Claude Opus 4.5"
  // and `4-5` matches "claude-opus-4-5-20251101".
  const filtered = $derived.by(() => {
    const q = value.toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
    );
  });

  // Reset highlight when filter changes.
  $effect(() => {
    filtered;
    highlight = 0;
  });

  // Click outside closes without picking.
  $effect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  });

  function pick(opt: ComboOption) {
    value = opt.value;
    open = false;
    onpick?.(opt);
  }

  function move(delta: number) {
    if (filtered.length === 0) return;
    highlight = (highlight + delta + filtered.length) % filtered.length;
    // Scroll the highlighted row into view.
    tick().then(() => {
      listbox?.children[highlight]?.scrollIntoView({ block: 'nearest' });
    });
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) open = true;
      else move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      const opt = filtered[highlight];
      if (open && opt) {
        e.preventDefault();
        pick(opt);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();  // don't bubble to drawer-close
        open = false;
      }
    }
  }

  export function focus() { input?.focus(); }
</script>

<div bind:this={root} class="relative">
  <input
    bind:this={input}
    bind:value
    type="text"
    role="combobox"
    aria-expanded={open}
    aria-controls={listboxId}
    aria-autocomplete="list"
    {placeholder}
    class="text-pole w-full"
    onfocus={() => { if (options.length > 0) open = true; }}
    oninput={() => { open = true; }}
    {onkeydown}
  />

  {#if open && filtered.length > 0}
    <ul
      bind:this={listbox}
      id={listboxId}
      role="listbox"
      class="panel-chrome absolute left-0 right-0 top-full mt-1 z-10
             max-h-64 overflow-y-auto p-1 shadow-lg"
    >
      {#each filtered as opt, i (opt.value)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
        <li
          role="option"
          aria-selected={i === highlight}
          class="flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm
                 {i === highlight ? 'bg-white/10' : ''}"
          onmouseenter={() => highlight = i}
          onmousedown={(e) => { e.preventDefault(); pick(opt); }}
        >
          <span class="flex-1 truncate">{opt.label}</span>
          {#if opt.badge}
            <span class="text-xs opacity-60">{opt.badge}</span>
          {/if}
          {#if opt.meta}
            <span class="text-xs opacity-50 tabular-nums">{opt.meta}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
