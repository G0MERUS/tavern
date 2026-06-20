<!--
  Right-side character drawer. Two modes: list (browse/import) and edit.

  Edit shows the three fields you actually open this panel for — name,
  description, first_mes. The other five (personality, scenario,
  mes_example, system_prompt, post_history_instructions) live behind
  [Advanced]; alternate_greetings behind [Greetings]. Both popups bind
  live to the same characters.active.data; no second save path.
-->
<script lang="ts">
  import Drawer from '../ui/Drawer.svelte';
  import Field from '../ui/Field.svelte';
  import Input from '../ui/Input.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Button from '../ui/Button.svelte';
  import CharAdvanced, { charAdvanced } from '../popups/CharAdvanced.svelte';
  import Greetings, { greetings } from '../popups/Greetings.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { characters } from '$lib/state/characters.svelte';
  import { chat } from '$lib/state/chat.svelte';
  import { dialog } from '$lib/state/dialog.svelte';
  import { estimateTokens } from '$lib/core/tokenize';
  import { val, files, resetInput } from '$lib/utils/dom';
  import * as api from '$lib/api';
  import type { CardData } from '$lib/api/types';

  let editing = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  // ── List mode ─────────────────────────────────────────────────────────────
  async function pick(id: string): Promise<void> {
    await chat.openForCharacter(id);
  }

  async function onImport(e: Event): Promise<void> {
    const [file] = files(e);
    resetInput(e);
    if (file) await characters.import(file);
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  function patch<K extends keyof CardData>(key: K, value: CardData[K]): void {
    const c = characters.active;
    if (!c) return;
    c.data[key] = value;
    characters.saveData(c.id, { ...c.data });
  }

  // first_mes counts as greeting #1, so this is always ≥1.
  const greetingCount = $derived(
    characters.active ? 1 + characters.active.data.alternate_greetings.length : 0
  );

  async function deleteActive() {
    const c = characters.active;
    if (!c) return;
    if (!(await dialog.confirm(`Delete ${c.name}? This cannot be undone.`))) return;
    await characters.delete(c.id);
    editing = false;
  }
</script>

<Drawer
  open={ui.isOpen('character')}
  side="right"
  id="character"
  title={editing ? characters.active?.name ?? 'Character' : 'Characters'}
  onclose={() => ui.close('character')}
>
  {#snippet actions()}
    {#if !editing}
      <IconButton icon="plus" size="sm" title="Import"
        onclick={() => fileInput?.click()} />
      <input bind:this={fileInput} type="file" accept=".png,.json" hidden onchange={onImport} />
    {:else}
      <IconButton icon="chevron-left" size="sm" title="Back"
        onclick={() => (editing = false)} />
    {/if}
    {#if characters.active}
      <IconButton
        icon="pencil" size="sm" title="Edit" active={editing}
        onclick={() => (editing = !editing)}
      />
    {/if}
  {/snippet}

  {#if editing && characters.active}
    <!-- ════════════════ EDIT MODE ════════════════ -->
    {@const c = characters.active}
    <div class="flex flex-col gap-3">
      {#if c.avatar_url}
        <img src={c.avatar_url} alt={c.name} class="w-full max-w-48 mx-auto rounded object-cover" />
      {/if}

      <Field label="Name">
        <Input value={c.data.name} oninput={(e) => patch('name', val(e))} />
      </Field>
      <Field label="Description" tokens={estimateTokens(c.data.description)}>
        <Textarea value={c.data.description}
          oninput={(e) => patch('description', val(e))}
          sizeKey="char.description" rows={6} />
      </Field>
      <Field label="First message" tokens={estimateTokens(c.data.first_mes)}>
        <Textarea value={c.data.first_mes}
          oninput={(e) => patch('first_mes', val(e))} rows={4} />
      </Field>

      <div class="flex gap-2">
        <Button class="flex-1" onclick={greetings.show}>
          <span class="i-fa6-solid:wand-magic-sparkles mr-1"></span>
          Greetings ({greetingCount})
        </Button>
        <Button class="flex-1" onclick={charAdvanced.show}>
          <span class="i-fa6-solid:sliders mr-1"></span>
          Advanced
        </Button>
      </div>

      <hr class="opacity-20" />

      <div class="flex justify-between gap-2">
        <a class="menu-btn" href={api.characters.exportUrl(c.id, 'png')} download>
          <span class="i-fa6-solid:download mr-1"></span> Export
        </a>
        <button class="menu-btn !border-crimson !text-red-400" onclick={deleteActive}>
          <span class="i-fa6-solid:trash mr-1"></span> Delete
        </button>
      </div>
    </div>

  {:else}
    <!-- ════════════════ LIST MODE ════════════════ -->
    <div class="flex flex-col gap-2">
      <Input bind:value={characters.filter.query} placeholder="Search…" />

      <div class="flex flex-wrap gap-1">
        {#each characters.filtered as c (c.id)}
          <button
            class="relative w-full flex items-center gap-2 p-2 rounded
                   bg-black/20 hover:bg-white/5 border border-st-border/30
                   transition-colors"
            class:!border-quote={characters.active?.id === c.id}
            onclick={() => pick(c.id)}
          >
            {#if c.thumbnail_url}
              <img src={c.thumbnail_url} alt={c.name} class="w-10 h-10 rounded object-cover" />
            {:else}
              <div class="w-10 h-10 rounded bg-black/30"></div>
            {/if}
            <span class="flex-1 text-left text-sm truncate">{c.name}</span>
            {#if c.fav}
              <span class="i-fa6-solid:star text-xs text-golden"></span>
            {/if}
          </button>
        {/each}

        {#if characters.filtered.length === 0}
          <div class="w-full p-4 text-center text-sm opacity-50">
            No characters. Drop a .png card or click + to import.
          </div>
        {/if}
      </div>
    </div>
  {/if}
</Drawer>

<CharAdvanced />
<Greetings />
