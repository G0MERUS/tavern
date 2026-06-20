<!--
  Preset shell. Delegates to 6 children + 1 popup. The store handles
  parse/sanitize/save; this just composes the sections in screen order.

  PromptEditPopup mounts here (renders nothing when closed) — same pattern
  as Dialog mounting in App.svelte.
-->
<script lang="ts">
  import Drawer from '../ui/Drawer.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import PresetBar from '../preset/PresetBar.svelte';
  import SamplerSection from '../preset/SamplerSection.svelte';
  import QuickEdit from '../preset/QuickEdit.svelte';
  import UtilityPrompts from '../preset/UtilityPrompts.svelte';
  import BehaviorSection from '../preset/BehaviorSection.svelte';
  import PromptManager from '../preset/PromptManager.svelte';
  import PromptEditPopup from '../preset/PromptEditPopup.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { preset } from '$lib/state/preset.svelte';
  import { dialog } from '$lib/state/dialog.svelte';

  // Lazy load on first open. Subsequent opens are no-ops (list is cached).
  $effect(() => {
    if (ui.isOpen('preset') && preset.list.length === 0) {
      preset.load();
    }
  });

  async function create() {
    const name = await dialog.prompt('Preset name:', 'New Preset');
    if (!name) return;
    await preset.create(name);
  }
</script>

<Drawer
  open={ui.isOpen('preset')}
  side="left"
  id="preset"
  title="Presets"
  onclose={() => ui.close('preset')}
>
  {#snippet actions()}
    <IconButton icon="plus" size="sm" title="New preset" onclick={create} />
  {/snippet}

  <div class="flex flex-col gap-3">
    <PresetBar />

    {#if preset.active}
      <hr class="border-0 h-px"
        style="background: linear-gradient(90deg, transparent, var(--SmartThemeBorderColor), transparent)" />

      <SamplerSection />

      <hr class="border-0 h-px"
        style="background: linear-gradient(90deg, transparent, var(--SmartThemeBorderColor), transparent)" />

      <QuickEdit />
      <UtilityPrompts />
      <BehaviorSection />

      <hr class="border-0 h-px"
        style="background: linear-gradient(90deg, transparent, var(--SmartThemeBorderColor), transparent)" />

      <PromptManager />
    {:else if preset.list.length > 0}
      <p class="text-sm opacity-50 text-center py-4">Select a preset to edit.</p>
    {:else}
      <p class="text-sm opacity-50 text-center py-4">No presets yet. Create one to get started.</p>
    {/if}
  </div>
</Drawer>

<PromptEditPopup />
