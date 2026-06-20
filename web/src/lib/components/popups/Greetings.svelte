<!--
  Greeting list editor. first_mes + alternate_greetings presented as one flat
  list because that's the mental model — "this character has 4 greetings."
  Splits back into first_mes + alternate_greetings on every write.

  Each greeting becomes a swipe on message #0 of a new chat (chat.startNew()).
  Drag to reorder; #1 is the default. Delete on row #1 is disabled when it's
  the only row — V2 spec requires first_mes to exist as a string.
-->
<script module lang="ts">
  let open = $state(false);
  export const greetings = {
    get open() { return open; },
    show() { open = true; },
    close() { open = false; },
  };
</script>

<script lang="ts">
  import { fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { tick, untrack } from 'svelte';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import IconButton from '../ui/IconButton.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import Button from '../ui/Button.svelte';
  import { characters } from '$lib/state/characters.svelte';
  import { resize } from '$lib/actions/resize';
  import { estimateTokens } from '$lib/core/tokenize';

  interface Item { id: number; text: string }

  // dnd needs a writable array with stable ids. Sync from card data on open;
  // write back on every edit. The id is just a counter — DnD identity, not
  // greeting identity (greetings have no IDs in the V2 spec).
  let items = $state<Item[]>([]);
  let nextId = 0;
  let scroller: HTMLElement | undefined = $state();

  // Track ONLY `open`. The card reads must be untracked: write() mutates
  // first_mes/alternate_greetings, and tracking those would re-run this
  // effect on every keystroke — which rebuilds `items` with fresh ids,
  // remounting every row mid-edit. "Lag" was the remount churn.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      const c = characters.active;
      if (!c) return;
      items = [c.data.first_mes, ...c.data.alternate_greetings]
        .map((text) => ({ id: nextId++, text }));
      if (items.length === 0) items = [{ id: nextId++, text: '' }];
    });
  });

  function write() {
    const c = characters.active;
    if (!c) return;
    const arr = items.map((i) => i.text);
    c.data.first_mes = arr[0] ?? '';
    c.data.alternate_greetings = arr.slice(1);
    characters.saveData(c.id, { ...c.data });
  }

  function onConsider(e: CustomEvent<DndEvent<Item>>) {
    items = e.detail.items;
  }
  function onFinalize(e: CustomEvent<DndEvent<Item>>) {
    items = e.detail.items;
    write();
  }

  function patchText(id: number, text: string) {
    const item = items.find((i) => i.id === id);
    if (item) { item.text = text; write(); }
  }

  function remove(id: number) {
    if (items.length <= 1) return;
    items = items.filter((i) => i.id !== id);
    write();
  }

  async function add() {
    items = [...items, { id: nextId++, text: '' }];
    write();
    await tick();
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') greetings.close();
  }
</script>

{#if open && characters.active}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-9000 bg-black/60 flex items-center justify-center p-4"
    transition:fade={{ duration: 100 }}
    onkeydown={onkey}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div
      class="panel-chrome backdrop-blur-md flex flex-col w-full h-full max-w-3xl max-h-[90vh]"
      use:resize={{ axis: 'both', key: 'popup.greetings' }}
    >
      <header class="flex justify-between items-center p-3 border-b border-st-border flex-shrink-0">
        <h3 class="font-bold text-lg m-0">Greetings — {characters.active.data.name}</h3>
        <IconButton icon="xmark" size="sm" title="Close" onclick={greetings.close} />
      </header>

      <p class="text-xs opacity-60 px-4 pt-3">
        Each greeting becomes a swipe on the first message of a new chat.
        Drag to reorder. The first one is the default.
      </p>

      <div bind:this={scroller} class="flex-1 overflow-y-auto p-4">
        <div
          class="flex flex-col gap-3"
          use:dndzone={{ items, flipDurationMs: 150, dropTargetStyle: {} }}
          onconsider={onConsider}
          onfinalize={onFinalize}
        >
          {#each items as item, i (item.id)}
            <div animate:flip={{ duration: 150 }}
              class="flex flex-col gap-1 p-2 border border-st-border rounded">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs opacity-50 font-bold">#{i + 1}</span>
                <span class="flex items-center gap-1">
                  <span class="i-fa6-solid:grip-vertical text-xs opacity-30 cursor-grab"
                    title="Drag to reorder"></span>
                  <IconButton icon="trash" size="sm" title="Delete"
                    class="!text-red-400"
                    disabled={items.length <= 1}
                    onclick={() => remove(item.id)} />
                </span>
              </div>
              <!-- No sizeKey: greetings vary in length; you don't want #3's
                   height applying to #1. Auto-grow with the standard cap. -->
              <Textarea value={item.text}
                oninput={(e) => patchText(item.id, (e.currentTarget as HTMLTextAreaElement).value)}
                maxHeight={300} rows={3} />
              <div class="text-right text-xs opacity-40">{estimateTokens(item.text)}t</div>
            </div>
          {/each}
        </div>
      </div>

      <div class="p-3 border-t border-st-border flex justify-center flex-shrink-0">
        <Button onclick={add}>
          <span class="i-fa6-solid:plus mr-1"></span> Add greeting
        </Button>
      </div>
    </div>
  </div>
{/if}
