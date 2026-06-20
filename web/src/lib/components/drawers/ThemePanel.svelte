<!--
  Center drawer, var(--sheldWidth) wide. Five sections: ThemeBar always
  visible at top, then four InlineDrawers (Colors open by default, rest
  closed). The cascade lives in theme.svelte.ts — this is just forms.

  The settings.colors → theme extraction is the load-bearing move here. The
  old 89-LOC panel had 9 native color inputs that silently dropped alpha; the
  new ColorPicker composes native + alpha slider, and themes are saved/named/
  exported instead of being a single global blob.
-->
<script lang="ts">
  import Drawer from '../ui/Drawer.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import ThemeBar from '../theme/ThemeBar.svelte';
  import ColorSection from '../theme/ColorSection.svelte';
  import LayoutSection from '../theme/LayoutSection.svelte';
  import ToggleSection from '../theme/ToggleSection.svelte';
  import CustomCssSection from '../theme/CustomCssSection.svelte';
</script>

<Drawer
  open={ui.isOpen('theme')}
  side="center"
  title="Theme"
  onclose={() => ui.close('theme')}
>
  <div class="flex flex-col gap-3">
    <ThemeBar />
    <ColorSection />
    <LayoutSection />
    <ToggleSection />
    <CustomCssSection />
  </div>
</Drawer>
