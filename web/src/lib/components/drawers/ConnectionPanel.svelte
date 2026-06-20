<!--
  Left-side API connection drawer. Shell only — the form and rows do the work.

  Why a list instead of a <Select>: with 2 connections a select is fine. With
  6 (one per provider you actually use, plus a couple of locals) you want to
  see them at a glance with their model names. ST's "Connection Profile" select
  solves this with a layer of indirection; we just show the list.
-->
<script lang="ts">
  import Drawer from '../ui/Drawer.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import ConnectionForm from './ConnectionForm.svelte';
  import ConnectionRow from './ConnectionRow.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { connections } from '$lib/state/connections.svelte';
  import { dialog } from '$lib/state/dialog.svelte';

  type Mode = 'list' | 'create' | { editing: string };
  let mode = $state<Mode>('list');

  const editingConn = $derived(
    typeof mode === 'object' ? connections.byId(mode.editing) : undefined,
  );

  // If the connection being edited is deleted out from under us, drop back.
  $effect(() => {
    if (typeof mode === 'object' && !editingConn) mode = 'list';
  });

  async function deleteWithConfirm(id: string) {
    const c = connections.byId(id);
    if (!c) return;
    if (!(await dialog.confirm(`Delete connection "${c.label}"?`))) return;
    await connections.delete(id);
  }

  function close() {
    mode = 'list';
    ui.close('connection');
  }
</script>

<Drawer
  open={ui.isOpen('connection')}
  side="center"
  title="API Connection"
  onclose={close}
>
  {#snippet actions()}
    <IconButton icon="plus" size="sm" title="New connection"
      active={mode === 'create'}
      onclick={() => mode = mode === 'create' ? 'list' : 'create'} />
  {/snippet}

  <div class="flex flex-col gap-3">
    {#if mode === 'create'}
      <ConnectionForm
        oncancel={() => mode = 'list'}
        onsaved={(c) => { connections.select(c.id); mode = 'list'; }}
      />
    {:else if typeof mode === 'object' && editingConn}
      {#key editingConn.id}
        <ConnectionForm
          editing={editingConn}
          oncancel={() => mode = 'list'}
          onsaved={() => mode = 'list'}
        />
      {/key}
    {/if}

    <div class="flex flex-col gap-1">
      <h4 class="text-xs font-bold opacity-50 uppercase tracking-wide px-1">
        Connections
      </h4>
      {#each connections.list as c (c.id)}
        <ConnectionRow
          {c}
          active={c.id === connections.active?.id}
          onselect={(id) => connections.select(id)}
          onedit={(id) => mode = { editing: id }}
          ondelete={deleteWithConfirm}
        />
      {:else}
        <p class="text-sm opacity-50 text-center py-4">
          No connections yet. Click + to add one.
        </p>
      {/each}
    </div>
  </div>
</Drawer>
