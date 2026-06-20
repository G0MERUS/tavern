<!--
  The 9-icon top bar. Hard constraint #1 — same icons, same order, same drawer
  mapping as original ST. Active drawer = orange tint + underline.
-->
<script lang="ts">
  import { ui, type DrawerId } from '$lib/state/ui.svelte';

  interface Tab { id: DrawerId; icon: string; title: string }

  // Order is load-bearing. Don't sort.
  const tabs: Tab[] = [
    { id: 'connection', icon: 'plug',          title: 'API Connections' },
    { id: 'preset',     icon: 'sliders',       title: 'Presets' },
    { id: 'lorebook',   icon: 'book-atlas',    title: 'World Info' },
    { id: 'theme',      icon: 'palette',       title: 'Themes' },
    { id: 'background', icon: 'image',         title: 'Backgrounds' },
    { id: 'extension',  icon: 'cubes',         title: 'Extensions' },
    { id: 'persona',    icon: 'face-smile',    title: 'Personas' },
    { id: 'character',  icon: 'address-card',  title: 'Characters' },
    { id: 'settings',   icon: 'gear',          title: 'Settings' },
  ];
</script>

<nav
  id="top-bar"
  class="fixed top-0 left-0 right-0 z-3000 h-9
         flex items-center justify-center gap-1
         bg-blur-tint backdrop-blur-[var(--SmartThemeBlurStrength)]
         border-b border-st-border"
>
  {#each tabs as tab (tab.id)}
    {@const open = ui.isOpen(tab.id)}
    <button
      class="drawer-icon relative w-9 h-9 flex items-center justify-center"
      data-open={open}
      onclick={() => ui.toggle(tab.id)}
      title={tab.title}
      aria-label={tab.title}
      aria-pressed={open}
    >
      <span class="i-fa6-solid:{tab.icon} block"></span>
      {#if open}
        <span class="absolute bottom-0 left-2 right-2 h-0.5 bg-quote"></span>
      {/if}
    </button>
  {/each}
</nav>
