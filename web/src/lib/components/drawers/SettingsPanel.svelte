<script lang="ts">
  import Drawer from '../ui/Drawer.svelte';
  import Field from '../ui/Field.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import Select from '../ui/Select.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { settings, persist } from '$lib/state/settings.svelte';

  // bind:checked + onchange→persist. The toggle component fires onchange
  // after the bind updates settings, so persist sees the new value.
  function p(key: Parameters<typeof persist>[0]) {
    return () => persist(key);
  }
</script>

<Drawer
  open={ui.isOpen('settings')}
  side="right"
  id="settings"
  title="Settings"
  onclose={() => ui.close('settings')}
>
  <div class="flex flex-col gap-3">
    <h4 class="text-xs opacity-60 uppercase tracking-wide m-0">Chat</h4>

    <Toggle bind:checked={settings.sendOnEnter} onchange={p('sendOnEnter')}
      label="Send on Enter (Shift+Enter for newline)" />
    <Toggle bind:checked={settings.autoScroll} onchange={p('autoScroll')}
      label="Auto-scroll to bottom" />
    <Toggle bind:checked={settings.confirmDelete} onchange={p('confirmDelete')}
      label="Confirm before deleting messages" />

    <hr class="opacity-20" />
    <h4 class="text-xs opacity-60 uppercase tracking-wide m-0">Rendering</h4>

    <Toggle bind:checked={settings.renderMarkdown} onchange={p('renderMarkdown')}
      label="Render markdown" />
    <Toggle bind:checked={settings.allowMessageStyles} onchange={p('allowMessageStyles')}
      label="Allow scoped CSS in messages" />

    <hr class="opacity-20" />
    <h4 class="text-xs opacity-60 uppercase tracking-wide m-0">Generation</h4>

    <Field label="Post-process mode" hint="Provider quirk shim">
      <Select
        bind:value={settings.postProcess}
        options={[
          { value: 'none', label: 'None' },
          { value: 'merge', label: 'Merge same-role' },
          { value: 'semi', label: 'Semi-strict (user-first)' },
          { value: 'strict', label: 'Strict alternation' },
          { value: 'single', label: 'Single message' },
        ]}
        onchange={p('postProcess')}
      />
    </Field>

    <Field label="System prompt template">
      <Textarea
        bind:value={settings.systemPrompt}
        rows={4}
        onchange={p('systemPrompt')}
      />
    </Field>
  </div>
</Drawer>
