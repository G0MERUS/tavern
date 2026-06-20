<!--
  The format-string templates with restore-to-default. ST index.html
  lines 832–987. Each block is the same shape: label, restore button,
  hint, textarea. Loop a config array.
-->
<script lang="ts">
  import Textarea from '../ui/Textarea.svelte';
  import InlineDrawer from '../ui/InlineDrawer.svelte';
  import { preset } from '$lib/state/preset.svelte';
  import { DEFAULT_TEMPLATES } from '$lib/core/preset-defaults';
  import type { PresetTemplates } from '$lib/api/types';

  const t = $derived(preset.active?.templates);

  interface TemplateConfig {
    key: keyof PresetTemplates;
    label: string;
    hint: string;
  }

  const FIELDS: TemplateConfig[] = [
    { key: 'impersonation_prompt', label: 'Impersonation prompt',
      hint: 'Sent when generating a message as the user (impersonate mode).' },
    { key: 'wi_format', label: 'World Info format template',
      hint: '{0} is replaced with each activated lorebook entry.' },
    { key: 'scenario_format', label: 'Scenario format template',
      hint: 'Wraps the scenario before insertion. {{scenario}} is the placeholder.' },
    { key: 'personality_format', label: 'Personality format template',
      hint: 'Wraps the character personality. {{personality}} is the placeholder.' },
    { key: 'new_chat_prompt', label: 'New Chat',
      hint: 'Marker inserted at the start of chat history.' },
    { key: 'new_example_chat_prompt', label: 'New Example Chat',
      hint: 'Marker inserted before each example dialogue block.' },
    { key: 'continue_nudge_prompt', label: 'Continue nudge',
      hint: 'Sent when continuing the last message (unless Continue prefill is on).' },
    { key: 'send_if_empty', label: 'Replace empty message',
      hint: 'Sent in place of an empty user message. Empty = send nothing.' },
  ];

  function isDefault(key: keyof PresetTemplates): boolean {
    return t?.[key] === DEFAULT_TEMPLATES[key];
  }
</script>

{#if t}
  <InlineDrawer title="Utility Prompts" key="utility-prompts">
    {#each FIELDS as f (f.key)}
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class="text-sm opacity-80">{f.label}</span>
          <button
            type="button"
            class="right-menu-btn i-fa6-solid:clock-rotate-left text-xs"
            class:opacity-30={isDefault(f.key)}
            disabled={isDefault(f.key)}
            title="Restore default"
            onclick={() => preset.resetTemplate(f.key)}
          ></button>
        </div>
        <p class="text-xs opacity-50">{f.hint}</p>
        <Textarea
          rows={2}
          maxHeight={200}
          value={t[f.key]}
          onblur={(e) => preset.setTemplate(f.key, (e.currentTarget as HTMLTextAreaElement).value)}
        />
      </div>
    {/each}
  </InlineDrawer>
{/if}
