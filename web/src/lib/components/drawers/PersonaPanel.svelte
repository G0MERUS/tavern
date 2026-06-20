<script lang="ts">
  import Drawer from '../ui/Drawer.svelte';
  import Field from '../ui/Field.svelte';
  import Input from '../ui/Input.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { personas } from '$lib/state/personas.svelte';
  import { dialog } from '$lib/state/dialog.svelte';
  import { val } from '$lib/utils/dom';

  async function create() {
    const name = await dialog.prompt('Persona name:', 'User');
    if (name) await personas.create({ name });
  }

  async function del(id: string) {
    if (!(await dialog.confirm('Delete this persona?'))) return;
    await personas.delete(id);
  }
</script>

<Drawer
  open={ui.isOpen('persona')}
  side="right"
  id="persona"
  title="Personas"
  onclose={() => ui.close('persona')}
>
  {#snippet actions()}
    <IconButton icon="plus" size="sm" title="New persona" onclick={create} />
  {/snippet}

  <div class="flex flex-col gap-2">
    {#each personas.list as p (p.id)}
      {@const active = personas.active?.id === p.id}
      <div class="panel-chrome p-2 flex flex-col gap-2" class:!border-quote={active}>
        <div class="flex items-center gap-2">
          {#if p.thumbnail_url}
            <img src={p.thumbnail_url} alt={p.name} class="w-8 h-8 rounded object-cover" />
          {/if}
          <Input
            value={p.name}
            class="flex-1"
            onchange={(e) => personas.patch(p.id, { name: val(e) })}
          />
          <IconButton
            icon="circle-check" size="sm" title="Set active"
            active={active}
            onclick={() => personas.select(p.id)}
          />
          <IconButton icon="trash" size="sm" title="Delete"
            onclick={() => del(p.id)} />
        </div>
        <Textarea
          value={p.description}
          placeholder="Persona description…"
          rows={2}
          onchange={(e) => personas.patch(p.id, { description: val(e) })}
        />
      </div>
    {/each}

    {#if personas.list.length === 0}
      <div class="p-4 text-center text-sm opacity-50">No personas yet.</div>
    {/if}
  </div>
</Drawer>
