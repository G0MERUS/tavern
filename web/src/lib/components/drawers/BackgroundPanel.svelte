<script lang="ts">
  import Drawer from '../ui/Drawer.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { settings, persist } from '$lib/state/settings.svelte';
  import * as api from '$lib/api';
  import type { Background } from '$lib/api/types';
  import { files, resetInput } from '$lib/utils/dom';

  let backgrounds = $state<Background[]>([]);
  let fileInput: HTMLInputElement | undefined = $state();

  $effect(() => { load(); });

  async function load() {
    const { items } = await api.backgrounds.list();
    backgrounds = items;
  }

  function pick(filename: string) {
    settings.background = filename;
    persist('background');
  }

  async function upload(e: Event): Promise<void> {
    const [file] = files(e);
    if (!file) return;
    resetInput(e);
    const bg = await api.backgrounds.upload(file);
    backgrounds = [bg, ...backgrounds];
    pick(bg.filename);
  }
</script>

<Drawer
  open={ui.isOpen('background')}
  side="center"
  title="Backgrounds"
  onclose={() => ui.close('background')}
>
  {#snippet actions()}
    <IconButton icon="plus" size="sm" title="Upload"
      onclick={() => fileInput?.click()} />
    <input bind:this={fileInput} type="file" accept="image/*" hidden onchange={upload} />
  {/snippet}

  <div class="grid grid-cols-3 gap-2">
    <button
      class="aspect-video rounded bg-black border-2"
      class:border-quote={settings.background === ''}
      class:border-transparent={settings.background !== ''}
      onclick={() => pick('')}
      title="None"
    >
      <span class="i-fa6-solid:ban opacity-30"></span>
    </button>

    {#each backgrounds as bg (bg.filename)}
      {@const selected = settings.background === bg.filename}
      <button
        class="relative aspect-video rounded overflow-hidden border-2"
        class:border-quote={selected}
        class:border-transparent={!selected}
        onclick={() => pick(bg.filename)}
        title={bg.filename}
      >
        <img src={bg.thumbnail_url} alt={bg.filename} class="w-full h-full object-cover" />
      </button>
    {/each}
  </div>
</Drawer>
