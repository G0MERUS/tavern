<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { dialog } from '$lib/state/dialog.svelte';
  import Button from './Button.svelte';

  let promptValue = $state('');

  $effect(() => {
    if (dialog.state.open && dialog.state.type === 'prompt') {
      promptValue = dialog.state.defaultValue;
    }
  });

  function ok(): void {
    dialog.resolve(dialog.state.type === 'prompt' ? promptValue : true);
  }

  function onkey(e: KeyboardEvent): void {
    if (e.key === 'Escape') dialog.resolve(false);
    if (e.key === 'Enter' && dialog.state.type !== 'alert') ok();
  }
</script>

{#if dialog.state.open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-9999 bg-black/60 flex items-center justify-center"
    transition:fade={{ duration: 100 }}
    onkeydown={onkey}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div
      class="panel-chrome backdrop-blur-md p-4 min-w-80 max-w-md flex flex-col gap-3"
      transition:scale={{ start: 0.95, duration: 100 }}
    >
      {#if dialog.state.title}
        <h3 class="font-bold text-lg m-0">{dialog.state.title}</h3>
      {/if}

      <p class="text-sm m-0 whitespace-pre-wrap">{dialog.state.message}</p>

      {#if dialog.state.type === 'prompt'}
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={promptValue} class="text-pole" autofocus />
      {/if}

      <div class="flex justify-end gap-2 mt-2">
        {#if dialog.state.type !== 'alert'}
          <Button onclick={() => dialog.resolve(false)}>Cancel</Button>
        {/if}
        <Button variant="primary" onclick={ok}>OK</Button>
      </div>
    </div>
  </div>
{/if}
