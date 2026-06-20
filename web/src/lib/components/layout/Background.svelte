<script lang="ts">
  import { settings } from '$lib/state/settings.svelte';

  const url = $derived(
    settings.background ? `/blobs/backgrounds/${settings.background}` : ''
  );

  function hideOnError(e: Event): void {
    if (e.currentTarget instanceof HTMLImageElement) {
      e.currentTarget.style.display = 'none';
    }
  }
</script>

<div class="fixed inset-0 z-1 bg-black pointer-events-none">
  {#if url}
    <img src={url} alt="" class="w-full h-full object-cover" onerror={hideOnError} />
  {/if}
</div>
