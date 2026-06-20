<!--
  Root component. The boot sequence.

  Theme cascade lives in state/theme.svelte.ts now — that store owns the
  $effect.root that writes :root vars and body classes. App's only job is
  theme.load() in onMount.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import Background from '$lib/components/layout/Background.svelte';
  import TopBar from '$lib/components/layout/TopBar.svelte';
  import Sheld from '$lib/components/chat/Sheld.svelte';
  import Toasts from '$lib/components/ui/Toasts.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';

  import SwipePicker from '$lib/components/popups/SwipePicker.svelte';
  import CharacterPanel from '$lib/components/drawers/CharacterPanel.svelte';
  import ConnectionPanel from '$lib/components/drawers/ConnectionPanel.svelte';
  import PersonaPanel from '$lib/components/drawers/PersonaPanel.svelte';
  import PresetPanel from '$lib/components/drawers/PresetPanel.svelte';
  import SettingsPanel from '$lib/components/drawers/SettingsPanel.svelte';
  import ThemePanel from '$lib/components/drawers/ThemePanel.svelte';
  import BackgroundPanel from '$lib/components/drawers/BackgroundPanel.svelte';
  import LorebookPanel from '$lib/components/drawers/LorebookPanel.svelte';

  import { ui, viewport } from '$lib/state/ui.svelte';
  import { loadSettings } from '$lib/state/settings.svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { characters } from '$lib/state/characters.svelte';
  import { personas } from '$lib/state/personas.svelte';
  import { connections } from '$lib/state/connections.svelte';
  import { catalog } from '$lib/state/catalog.svelte';
  import { lorebooks } from '$lib/state/lorebooks.svelte';
  import { preset } from '$lib/state/preset.svelte';
  import { chat } from '$lib/state/chat.svelte';
  import { toasts } from '$lib/state/toast.svelte';
  import { sniffJsonShape } from '$lib/utils/files';

  let booted = $state(false);

  // ── Viewport tracking ─────────────────────────────────────────────────────
  $effect(() => {
    const mq = matchMedia('(max-width: 1000px)');
    const update = () => { viewport.isMobile = mq.matches; };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });

  // ── Hotkeys ───────────────────────────────────────────────────────────────
  function onKeydown(e: KeyboardEvent) {
    // Don't intercept while typing.
    const target = e.target as HTMLElement;
    if (target.matches('input, textarea, select, [contenteditable]')) return;

    if (e.key === 'Escape') {
      // Delete-mode wins over drawers — it's a higher-priority transient
      // state the user entered most recently.
      if (chat.deleteMode) {
        chat.exitDeleteMode();
        e.preventDefault();
        return;
      }
      if (ui.closeTop()) e.preventDefault();
    }
  }

  // ── Drag-drop import ──────────────────────────────────────────────────────
  // .png/.json on the window → route to the right importer by sniffing.
  function onDragOver(e: DragEvent) { e.preventDefault(); }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.png')) {
      await characters.import(file);
      return;
    }
    if (file.name.endsWith('.json')) {
      try {
        const json = JSON.parse(await file.text());
        const shape = sniffJsonShape(json);
        if (shape === 'character') {
          await characters.import(file);
        } else if (shape === 'lorebook') {
          toasts.info('Lorebook import — open World Info to import');
        } else {
          toasts.warning('Unknown JSON shape');
        }
      } catch {
        toasts.error('Invalid JSON');
      }
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  onMount(async () => {
    try {
      await loadSettings();
      // Parallel load — no inter-deps.
      await Promise.all([
        characters.load(),
        personas.load(),
        connections.load(),
        catalog.load(),
        lorebooks.load(),
        preset.load(),
        theme.load(),
      ]);
      booted = true;
    } catch (err) {
      toasts.error(`Boot failed: ${err instanceof Error ? err.message : String(err)}`);
      booted = true;  // show UI anyway
    }
  });
</script>

<svelte:window onkeydown={onKeydown} ondragover={onDragOver} ondrop={onDrop} />

<Background />

{#if booted}
  <TopBar />
  <Sheld />

  <ConnectionPanel />
  <PresetPanel />
  <LorebookPanel />
  <ThemePanel />
  <BackgroundPanel />
  <PersonaPanel />
  <CharacterPanel />
  <SettingsPanel />
{:else}
  <div class="fixed inset-0 flex items-center justify-center z-50">
    <div class="flex items-center gap-1 opacity-50">
      <span class="animate-pulse" style="animation-delay: 0ms">●</span>
      <span class="animate-pulse" style="animation-delay: 150ms">●</span>
      <span class="animate-pulse" style="animation-delay: 300ms">●</span>
    </div>
  </div>
{/if}

<SwipePicker />
<Toasts />
<Dialog />
