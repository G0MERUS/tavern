<!--
  [<select>........] [💾] [✏️] [📄+] [📥] [📤] [🗑]

  The preset switcher + lifecycle actions. Import file picker is a hidden
  input — the icon button proxy-clicks it. Export builds a blob and triggers
  a download.
-->
<script lang="ts">
  import Select from '../ui/Select.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import { preset } from '$lib/state/preset.svelte';
  import { dialog } from '$lib/state/dialog.svelte';
  import { toasts } from '$lib/state/toast.svelte';
  import { download, readFileText } from '$lib/utils/files';
  import { files, resetInput } from '$lib/utils/dom';

  let fileInput: HTMLInputElement | undefined = $state();

  const options = $derived(preset.list.map((p) => ({ value: p.id, label: p.name })));
  const currentName = $derived(preset.list.find((p) => p.id === preset.activeId)?.name ?? '');

  async function save() {
    await preset.saveNow();
    toasts.success('Saved');
  }

  async function rename() {
    const name = await dialog.prompt('Rename preset:', currentName);
    if (!name) return;
    await preset.rename(name);
  }

  async function saveAs() {
    const name = await dialog.prompt('Save as:', `${currentName} (copy)`);
    if (!name) return;
    const p = await preset.duplicate();
    if (p && name !== p.name) await preset.rename(name);
  }

  async function importFile(e: Event) {
    const file = files(e)[0];
    resetInput(e);
    if (!file) return;
    // Prompt identifiers are per-preset UUIDs and import creates a fresh
    // preset — nothing to collide with. No confirm needed.
    const name = file.name.replace(/\.(json|settings)$/i, '');
    try {
      const json = JSON.parse(await readFileText(file));
      await preset.importJSON(json, name);
      toasts.success(`Imported "${name}"`);
    } catch (err) {
      toasts.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function exportFile() {
    const date = new Date().toISOString().slice(0, 10);
    download(preset.exportJSON(), `${currentName || 'preset'}-${date}.json`);
  }

  async function del() {
    if (preset.list.length <= 1) return;
    if (!(await dialog.confirm(`Delete preset "${currentName}"?`))) return;
    await preset.delete();
  }
</script>

<div class="flex gap-1 items-center">
  <Select
    class="flex-1 min-w-0"
    value={preset.activeId ?? ''}
    {options}
    placeholder="No preset"
    onchange={(id) => preset.select(id)}
  />
  <IconButton icon="floppy-disk" size="sm" title="Save" onclick={save} disabled={!preset.activeId} />
  <IconButton icon="pencil" size="sm" title="Rename" onclick={rename} disabled={!preset.activeId} />
  <IconButton icon="file-circle-plus" size="sm" title="Save as" onclick={saveAs} disabled={!preset.activeId} />
  <IconButton icon="file-import" size="sm" title="Import" onclick={() => fileInput?.click()} />
  <IconButton icon="file-export" size="sm" title="Export" onclick={exportFile} disabled={!preset.activeId} />
  <IconButton icon="trash-can" size="sm" title="Delete" onclick={del}
    disabled={!preset.activeId || preset.list.length <= 1} />

  <input
    bind:this={fileInput}
    type="file"
    accept=".json,.settings"
    class="hidden"
    onchange={importFile}
  />
</div>
