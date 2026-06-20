<!--
  ▾ Layout
    [Avatars: select] [Chat: select] [Font: combobox]
    2-col slider grid: chat width / font scale / blur / shadow / corners / density

  blur+shadow disable when their toggles are on. The disabled coupling mirrors
  ST: when "No Blur" is checked, the slider fades and stops responding.
-->
<script lang="ts">
  import InlineDrawer from '../ui/InlineDrawer.svelte';
  import Select from '../ui/Select.svelte';
  import Slider from '../ui/Slider.svelte';
  import Combobox from '../ui/Combobox.svelte';
  import Field from '../ui/Field.svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { FONTS } from '$lib/core/theme-defaults';

  const AVATAR_OPTS = [
    { value: 'circle', label: 'Circle' },
    { value: 'square', label: 'Square' },
    { value: 'rounded', label: 'Rounded' },
    { value: 'rectangle', label: 'Rectangle (tall)' },
  ];

  const DISPLAY_OPTS = [
    { value: 'flat', label: 'Flat' },
    { value: 'bubbles', label: 'Bubbles' },
    { value: 'document', label: 'Document' },
  ];

  const L = $derived(theme.active.layout);
  const T = $derived(theme.active.toggles);
</script>

<InlineDrawer title="Layout" key="theme.layout">
  <div class="grid grid-cols-2 max-mobile:grid-cols-1 gap-2">
    <Field label="Avatars">
      <Select bind:value={theme.active.layout.avatar_style} options={AVATAR_OPTS}
        onchange={theme.markDirty} />
    </Field>
    <Field label="Chat style">
      <Select bind:value={theme.active.layout.chat_display} options={DISPLAY_OPTS}
        onchange={theme.markDirty} />
    </Field>
  </div>

  <Field label="Font" hint="free text accepted">
    <!-- Combobox onpick fires on selection from the list; we also need
         markDirty on free-text typing. The bound input element accepts
         oninput passthrough. -->
    <div oninput={theme.markDirty}>
      <Combobox bind:value={theme.active.layout.font} options={FONTS}
        placeholder="Noto Sans" onpick={theme.markDirty} />
    </div>
  </Field>

  <div class="grid grid-cols-2 max-mobile:grid-cols-1 gap-3 mt-2">
    <Slider label="Chat width (vw)" bind:value={theme.active.layout.chat_width}
      min={25} max={100} step={1} onchange={theme.markDirty} />
    <Slider label="Font scale" bind:value={theme.active.layout.font_scale}
      min={0.5} max={1.5} step={0.05} onchange={theme.markDirty} />
    <Slider label="Blur strength (px)" bind:value={theme.active.layout.blur_strength}
      min={0} max={30} step={1} disabled={T.no_blur} onchange={theme.markDirty} />
    <Slider label="Shadow width (px)" bind:value={theme.active.layout.shadow_width}
      min={0} max={5} step={0.5} disabled={T.no_shadows} onchange={theme.markDirty} />
    <Slider label="Corner radius (px)" bind:value={theme.active.layout.corner_radius}
      min={0} max={20} step={1} onchange={theme.markDirty} />
    <Slider label="Message density" bind:value={theme.active.layout.message_density}
      min={0.7} max={1.3} step={0.05} onchange={theme.markDirty} />
  </div>
</InlineDrawer>
