<!--
  ▾ Colors ────────────────────────── [🪄][🎲]
    [preview chip — 8 LOC, shows body/quote/em/u/border/botMes at once]
    [10 ColorPicker rows — order matches ST for muscle memory]

  [🪄] = derive from current background (the /bgcol slash command, with a UI)
  [🎲] = random palette over a random hue at C=0.15, L=0.4
-->
<script lang="ts">
  import InlineDrawer from '../ui/InlineDrawer.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import ColorPicker from '../ui/ColorPicker.svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { settings } from '$lib/state/settings.svelte';
  import { toasts } from '$lib/state/toast.svelte';
  import { DEFAULT_COLORS } from '$lib/core/theme-defaults';
  import { extractDominantColor, generateThemePalette, randomPalette } from '$lib/core/theme-generator';
  import type { ThemeColors } from '$lib/api/types';

  const FIELDS: Array<{ key: keyof ThemeColors; label: string }> = [
    { key: 'body',            label: 'Main text' },
    { key: 'emphasis',        label: 'Italics text' },
    { key: 'quote',           label: 'Quote text' },
    { key: 'underline',       label: 'Underlined text' },
    { key: 'shadow',          label: 'Text shadow' },
    { key: 'blurTint',        label: 'UI background' },
    { key: 'chatTint',        label: 'Chat background' },
    { key: 'border',          label: 'UI border' },
    { key: 'userMesBlurTint', label: 'User message' },
    { key: 'botMesBlurTint',  label: 'AI message' },
  ];

  const C = $derived(theme.active.colors);

  async function autoFromBackground() {
    if (!settings.background) {
      toasts.warning('Set a background first');
      return;
    }
    try {
      const rgb = await extractDominantColor(`/blobs/backgrounds/${settings.background}`);
      theme.applyPalette(generateThemePalette(rgb));
      toasts.success('Palette derived from background');
    } catch (err) {
      toasts.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function random() {
    theme.applyPalette(randomPalette());
  }
</script>

<InlineDrawer title="Colors" key="theme.colors" defaultOpen>
  {#snippet actions()}
    <IconButton icon="wand-magic-sparkles" size="sm" title="Derive from background"
      onclick={autoFromBackground} />
    <IconButton icon="dice" size="sm" title="Random palette" onclick={random} />
  {/snippet}

  <!-- Preview chip. Updates live because style: directives read $state. -->
  <div
    class="rounded p-2 text-xs leading-relaxed mb-1"
    style:background={C.botMesBlurTint}
    style:color={C.body}
    style:border="1px solid {C.border}"
  >
    Lorem
    <q style:color={C.quote}>"ipsum dolor"</q>
    sit
    <em style:color={C.emphasis}>*amet*</em>,
    <u style:color={C.underline}>consectetur</u>.
  </div>

  {#each FIELDS as { key, label } (key)}
    <ColorPicker
      bind:value={theme.active.colors[key]}
      {label}
      defaultValue={DEFAULT_COLORS[key]}
      onchange={theme.markDirty}
    />
  {/each}
</InlineDrawer>
