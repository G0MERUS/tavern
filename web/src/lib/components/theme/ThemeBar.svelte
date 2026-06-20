<!--
  [<select>........] [💾] [✏️] [📄+] [📥] [📤] [🗑]

  PresetBar with s/preset/theme/g. Differences:
  - Export filename: ${name}.json (no date — themes don't churn like presets)
  - Import sniffs ST format (compat/theme.ts looks for main_text_color)
  - Delete is also disabled for bundled themes (you can edit them, not delete)
  - Save button pulses orange when dirty
-->
<script lang="ts">
  import Select from '../ui/Select.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { dialog } from '$lib/state/dialog.svelte';
  import { toasts } from '$lib/state/toast.svelte';
  import { download, readFileText } from '$lib/utils/files';
  import { files, resetInput } from '$lib/utils/dom';
  import { BUNDLED_IDS } from '$lib/core/theme-defaults';

  let fileInput: HTMLInputElement | undefined = $state();

  const options = $derived(theme.list.map((t) => ({ value: t.id, label: t.name })));
  const currentName = $derived(theme.list.find((t) => t.id === theme.activeId)?.name ?? '');
  const isBundled = $derived(theme.activeId !== null && BUNDLED_IDS.has(theme.activeId));
  // Last user theme: bundled don't count toward the "≥1 must remain" rule.
  const canDelete = $derived(!!theme.activeId && !isBundled && theme.list.length > 1);

  async function save() {
    await theme.saveNow();
    toasts.success('Saved');
  }

  async function rename() {
    const name = await dialog.prompt('Rename theme:', currentName);
    if (!name) return;
    await theme.rename(name);
  }

  async function saveAs() {
    const name = await dialog.prompt('Save as:', `${currentName} (copy)`);
    if (!name) return;
    const t = await theme.duplicate();
    if (t && name !== t.name) await theme.rename(name);
  }

  async function importFile(e: Event) {
    const file = files(e)[0];
    resetInput(e);
    if (!file) return;
    const name = file.name.replace(/\.json$/i, '');
    try {
      const json = JSON.parse(await readFileText(file));
      await theme.importJSON(json, name);
      toasts.success(`Imported "${name}"`);
    } catch (err) {
      toasts.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function exportFile() {
    download(theme.exportJSON(), `${currentName || 'theme'}.json`);
  }

  async function del() {
    if (!canDelete) return;
    if (!(await dialog.confirm(`Delete theme "${currentName}"?`))) return;
    try {
      await theme.delete();
    } catch (err) {
      toasts.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
</script>

<div class="flex gap-1 items-center">
  <Select
    class="flex-1 min-w-0"
    value={theme.activeId ?? ''}
    {options}
    placeholder="No theme"
    onchange={(id) => theme.select(id)}
  />
  <IconButton icon="floppy-disk" size="sm" title="Save" onclick={save}
    disabled={!theme.activeId} active={theme.dirty} />
  <IconButton icon="pencil" size="sm" title="Rename" onclick={rename}
    disabled={!theme.activeId || isBundled} />
  <IconButton icon="file-circle-plus" size="sm" title="Save as" onclick={saveAs}
    disabled={!theme.activeId} />
  <IconButton icon="file-import" size="sm" title="Import" onclick={() => fileInput?.click()} />
  <IconButton icon="file-export" size="sm" title="Export" onclick={exportFile}
    disabled={!theme.activeId} />
  <IconButton icon="trash-can" size="sm" title="Delete" onclick={del}
    disabled={!canDelete} />

  <input bind:this={fileInput} type="file" accept=".json" class="hidden" onchange={importFile} />
</div>
