<!--
  World Info / lorebook editor. Center drawer — gets the full sheld width.
  Two columns: book list on left, entries on right. Entries are inline-edited;
  patches debounce per-entry.
-->
<script lang="ts">
  import Drawer from '../ui/Drawer.svelte';
  import Input from '../ui/Input.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { lorebooks } from '$lib/state/lorebooks.svelte';
  import { settings, persist } from '$lib/state/settings.svelte';
  import { dialog } from '$lib/state/dialog.svelte';
  import type { LorebookEntry } from '$lib/api/types';
  import { val } from '$lib/utils/dom';

  // Entries can be huge — lazy collapse. Open set tracked here.
  let openEntries = $state<Set<string>>(new Set());

  function toggleEntry(id: string) {
    if (openEntries.has(id)) openEntries.delete(id);
    else openEntries.add(id);
    openEntries = new Set(openEntries);
  }

  function patchEntry(bookId: string, entry: LorebookEntry, patch: Partial<LorebookEntry>): void {
    lorebooks.patchEntry(bookId, entry.id, patch);
  }

  function parseKeys(s: string): string[] {
    return s.split(',').map((k) => k.trim()).filter(Boolean);
  }

  function isGlobal(bookId: string): boolean {
    return settings.globalLorebooks.includes(bookId);
  }

  function toggleGlobal(bookId: string) {
    if (isGlobal(bookId)) {
      settings.globalLorebooks = settings.globalLorebooks.filter((id) => id !== bookId);
    } else {
      settings.globalLorebooks = [...settings.globalLorebooks, bookId];
    }
    persist('globalLorebooks');
  }

  async function createBook() {
    const name = await dialog.prompt('Lorebook name:', 'New Lorebook');
    if (!name) return;
    const book = await lorebooks.create(name);
    await lorebooks.openEditor(book.id);
  }

  async function deleteBook(id: string) {
    if (!(await dialog.confirm('Delete this lorebook?'))) return;
    await lorebooks.delete(id);
  }

  async function deleteEntry(bookId: string, entryId: string) {
    if (!(await dialog.confirm('Delete this entry?'))) return;
    await lorebooks.deleteEntry(bookId, entryId);
  }
</script>

<Drawer
  open={ui.isOpen('lorebook')}
  side="center"
  title="World Info"
  onclose={() => ui.close('lorebook')}
>
  {#snippet actions()}
    <IconButton icon="plus" size="sm" title="New lorebook" onclick={createBook} />
  {/snippet}

  <div class="flex gap-3 min-h-80">
    <!-- ── Book list ─────────────────────────────────────────────────────── -->
    <div class="w-48 flex flex-col gap-1 flex-shrink-0">
      {#each lorebooks.list as book (book.id)}
        {@const editing = lorebooks.editing?.book.id === book.id}
        {@const global = isGlobal(book.id)}
        <div
          class="flex items-center gap-1 p-1.5 rounded hover:bg-white/5
                 {editing ? 'bg-quote/20' : 'bg-black/20'}"
        >
          <button
            class="flex-1 text-left text-sm truncate"
            onclick={() => lorebooks.openEditor(book.id)}
          >
            {book.name}
          </button>
          <button
            class="right-menu-btn i-fa6-solid:globe text-xs"
            class:text-quote={global}
            class:opacity-30={!global}
            onclick={() => toggleGlobal(book.id)}
            title={global ? 'Active globally' : 'Activate globally'}
          ></button>
          <button class="right-menu-btn i-fa6-solid:trash text-xs"
            onclick={() => deleteBook(book.id)} title="Delete"></button>
        </div>
      {/each}

      {#if lorebooks.list.length === 0}
        <div class="p-4 text-center text-xs opacity-50">No lorebooks</div>
      {/if}
    </div>

    <!-- ── Entry list ────────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col gap-2 min-w-0">
      {#if lorebooks.editing}
        {@const book = lorebooks.editing.book}
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm opacity-60">{lorebooks.editing.entries.length} entries</span>
          <IconButton icon="plus" size="sm" title="New entry"
            onclick={() => lorebooks.createEntry(book.id)} />
        </div>

        {#each lorebooks.editing.entries as entry (entry.id)}
          {@const isOpen = openEntries.has(entry.id)}
          <div class="panel-chrome p-2 flex flex-col gap-2">
            <button class="inline-drawer-toggle" onclick={() => toggleEntry(entry.id)}>
              <span class="flex items-center gap-2 flex-1 min-w-0">
                <span
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  class:bg-active={entry.enabled}
                  class:bg-gray-600={!entry.enabled}
                ></span>
                <span class="text-sm truncate">
                  {entry.comment || entry.keys.join(', ') || '(empty)'}
                </span>
              </span>
              <span
                class="i-fa6-solid:chevron-down text-xs transition-transform"
                class:rotate-180={isOpen}
              ></span>
            </button>

            {#if isOpen}
              <div class="flex flex-col gap-2 pl-2">
                <div class="flex items-center gap-2">
                  <Toggle
                    checked={entry.enabled}
                    onchange={(v) => patchEntry(book.id, entry, { enabled: v })}
                    label="Enabled"
                  />
                  <Toggle
                    checked={entry.constant}
                    onchange={(v) => patchEntry(book.id, entry, { constant: v })}
                    label="Constant"
                  />
                  <span class="flex-1"></span>
                  <IconButton icon="trash" size="sm" title="Delete"
                    onclick={() => deleteEntry(book.id, entry.id)} />
                </div>

                <Input
                  value={entry.keys.join(', ')}
                  placeholder="Keywords (comma-separated)"
                  onchange={(e) => patchEntry(book.id, entry, { keys: parseKeys(val(e)) })}
                />

                <Input
                  value={entry.comment}
                  placeholder="Comment (for you, not the AI)"
                  onchange={(e) => patchEntry(book.id, entry, { comment: val(e) })}
                />

                <Textarea
                  value={entry.content}
                  placeholder="Content to inject when keys match…"
                  rows={3}
                  oninput={(e) => patchEntry(book.id, entry, { content: val(e) })}
                />
              </div>
            {/if}
          </div>
        {/each}
      {:else}
        <div class="h-full flex items-center justify-center opacity-40 text-sm">
          Select a lorebook
        </div>
      {/if}
    </div>
  </div>
</Drawer>
