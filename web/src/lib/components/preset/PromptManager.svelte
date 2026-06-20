<!--
  The prompt order list with drag-reorder. ST PromptManager.js (2144 LOC,
  jQuery) reduced to a derived dnd zone over preset.order.

  svelte-dnd-action needs unique `id` on each item; we map identifier → id.
  On `consider` we update local state for live preview; on `finalize` we
  persist via preset.reorder().
-->
<script lang="ts">
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import Select from '../ui/Select.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import PromptRow from './PromptRow.svelte';
  import { promptEditor } from './PromptEditPopup.svelte';
  import { preset } from '$lib/state/preset.svelte';
  import { dialog } from '$lib/state/dialog.svelte';
  import { toasts } from '$lib/state/toast.svelte';
  import { canDelete } from '$lib/core/preset-defaults';
  import { download, readFileText } from '$lib/utils/files';
  import { files, resetInput } from '$lib/utils/dom';
  import type { PromptDefinition } from '$lib/api/types';

  interface DndItem {
    id: string;  // = identifier
    enabled: boolean;
    prompt: PromptDefinition;
  }

  let fileInput: HTMLInputElement | undefined = $state();
  let poolSelection = $state('');

  // dnd zone needs a writable array. Sync from preset.order via $effect; the
  // derived chain (preset.order → dndItems) breaks during drag because we
  // overwrite dndItems on `consider`.
  let dndItems = $state<DndItem[]>([]);

  $effect(() => {
    dndItems = preset.order
      .map((o) => {
        const prompt = preset.getPrompt(o.identifier);
        return prompt ? { id: o.identifier, enabled: o.enabled, prompt } : null;
      })
      .filter((x): x is DndItem => x !== null);
  });

  // Pool select: user prompts only, sorted by name.
  const poolOptions = $derived(
    preset.prompts
      .filter((p) => !p.system_prompt)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ value: p.identifier, label: p.name || p.identifier }))
  );

  const totalTokens = $derived(
    dndItems
      .filter((i) => i.enabled)
      .reduce((s, i) => s + (preset.tokenCounts[i.id] ?? 0), 0)
  );

  const selectedPrompt = $derived(preset.getPrompt(poolSelection));
  const canDeleteSelected = $derived(selectedPrompt ? canDelete(selectedPrompt) : false);

  // ── DnD ───────────────────────────────────────────────────────────────────

  function onConsider(e: CustomEvent<DndEvent<DndItem>>) {
    dndItems = e.detail.items;
  }

  function onFinalize(e: CustomEvent<DndEvent<DndItem>>) {
    dndItems = e.detail.items;
    preset.reorder(e.detail.items.map((i) => i.id));
  }

  // ── Toolbar actions ───────────────────────────────────────────────────────

  function insertPrompt() {
    if (!poolSelection) return;
    preset.insert(poolSelection);
    toasts.success('Inserted');
  }

  async function deletePrompt() {
    if (!poolSelection || !canDeleteSelected) return;
    if (!(await dialog.confirm('Delete this prompt? This removes it from the pool entirely.'))) return;
    preset.deletePrompt(poolSelection);
    poolSelection = '';
  }

  async function importList(e: Event) {
    const file = files(e)[0];
    resetInput(e);
    if (!file) return;
    if (!(await dialog.confirm('Existing prompts with the same ID will be overridden. Proceed?', 'Import prompts'))) return;
    try {
      const json = JSON.parse(await readFileText(file));
      preset.importPromptList(json);
      toasts.success('Prompt import complete.');
    } catch (err) {
      toasts.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function exportList() {
    const date = new Date();
    const stamp = `${String(date.getMonth() + 1).padStart(2, '0')}_${String(date.getDate()).padStart(2, '0')}_${date.getFullYear()}`;
    download(preset.exportPromptList(), `st-prompts-${stamp}.json`);
  }

  async function resetOrder() {
    if (!(await dialog.confirm('Reset prompt order? You will not lose any prompts.'))) return;
    preset.resetOrder();
  }

  function newPrompt() {
    promptEditor.open({
      identifier: crypto.randomUUID(),
      name: '',
      role: 'system',
      content: '',
      system_prompt: false,
      marker: false,
      injection_position: 0,
      injection_depth: 4,
      injection_order: 100,
      injection_trigger: [],
      forbid_overrides: false,
    });
  }
</script>

<div class="flex flex-col gap-2">
  <!-- ── Header ───────────────────────────────────────────────────────────── -->
  <div class="flex justify-between items-baseline">
    <span class="font-bold">Prompts</span>
    <span class="text-xs opacity-50">Total Tokens: {totalTokens}</span>
  </div>

  <!-- ── Toolbar ──────────────────────────────────────────────────────────── -->
  <div class="flex gap-1 items-center">
    <Select
      class="flex-1 min-w-0"
      bind:value={poolSelection}
      options={poolOptions}
      placeholder="Select prompt…"
    />
    <IconButton icon="link" size="sm" title="Insert"
      onclick={insertPrompt} disabled={!poolSelection} />
    <IconButton icon="xmark" size="sm" title="Delete from pool"
      class="!text-red-400"
      onclick={deletePrompt} disabled={!canDeleteSelected} />
    <IconButton icon="file-import" size="sm" title="Import prompts"
      onclick={() => fileInput?.click()} />
    <IconButton icon="file-export" size="sm" title="Export prompts"
      onclick={exportList} />
    <IconButton icon="arrow-rotate-left" size="sm" title="Reset order"
      class="!text-golden"
      onclick={resetOrder} />
    <IconButton icon="square-plus" size="sm" title="New prompt"
      onclick={newPrompt} />

    <input
      bind:this={fileInput}
      type="file"
      accept=".json"
      class="hidden"
      onchange={importList}
    />
  </div>

  <!-- ── List header + separator ──────────────────────────────────────────── -->
  <div class="grid grid-cols-[16px_1fr_80px_50px] gap-2 px-2 text-xs opacity-50">
    <span></span>
    <span>Name</span>
    <span></span>
    <span class="text-right">Tokens</span>
  </div>
  <hr class="border-0 h-px"
    style="background: linear-gradient(90deg, transparent, var(--SmartThemeBorderColor), transparent)" />

  <!-- ── DnD list ─────────────────────────────────────────────────────────── -->
  <ul
    class="flex flex-col gap-1 list-none p-0 m-0"
    use:dndzone={{ items: dndItems, flipDurationMs: 150, dropTargetStyle: {} }}
    onconsider={onConsider}
    onfinalize={onFinalize}
  >
    {#each dndItems as item (item.id)}
      <div animate:flip={{ duration: 150 }}>
        <PromptRow
          prompt={item.prompt}
          enabled={item.enabled}
          tokens={preset.tokenCounts[item.id] ?? 0}
          ontoggle={() => preset.toggle(item.id)}
          ondetach={() => preset.detach(item.id)}
          onedit={() => promptEditor.open(structuredClone($state.snapshot(item.prompt)))}
        />
      </div>
    {/each}
  </ul>
</div>
