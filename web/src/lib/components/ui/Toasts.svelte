<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts } from '$lib/state/toast.svelte';

  // Static class strings per type. Dynamic interpolation (`border-l-${color}`)
  // wouldn't survive UnoCSS extraction — the build scan needs literal classes.
  const tone = {
    info:    { border: 'border-l-blue-400',   icon: 'i-fa6-solid:circle-info text-blue-400' },
    success: { border: 'border-l-green-400',  icon: 'i-fa6-solid:circle-check text-green-400' },
    warning: { border: 'border-l-yellow-400', icon: 'i-fa6-solid:triangle-exclamation text-yellow-400' },
    error:   { border: 'border-l-red-400',    icon: 'i-fa6-solid:circle-xmark text-red-400' },
  };
</script>

<div class="fixed top-12 right-4 z-10000 flex flex-col gap-2 max-w-sm pointer-events-none">
  {#each toasts.items as t (t.id)}
    <button
      class="pointer-events-auto flex items-start gap-2 p-3 rounded
             bg-blur-tint backdrop-blur-md border-l-4 text-left text-sm shadow-lg
             {tone[t.type].border}"
      transition:fly={{ x: 100, duration: 200 }}
      onclick={() => toasts.dismiss(t.id)}
    >
      <span class="block mt-0.5 {tone[t.type].icon}"></span>
      <span class="flex-1">{t.message}</span>
    </button>
  {/each}
</div>
