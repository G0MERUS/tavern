<!--
  Behavior toggles, name handling, continue postfix, reasoning effort.
  ST index.html lines 1877–2210.

  Names + postfix are radio groups inside InlineDrawers whose subtitle shows
  the current selection. The numeric storage (-1/0/1/2) is an ST artifact —
  presets in the wild use it, so we keep it.
-->
<script lang="ts">
  import Toggle from '../ui/Toggle.svelte';
  import Select from '../ui/Select.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import InlineDrawer from '../ui/InlineDrawer.svelte';
  import Field from '../ui/Field.svelte';
  import { preset } from '$lib/state/preset.svelte';
  import type { PresetBehavior } from '$lib/api/types';

  const b = $derived(preset.active?.behavior);
  const t = $derived(preset.active?.templates);

  const NAMES_OPTS = [
    { value: -1, label: 'None', hint: 'Never add character name prefixes. May behave poorly in groups.' },
    { value: 0,  label: 'Default', hint: 'Add prefixes for groups and past personas.' },
    { value: 1,  label: 'Completion Object', hint: 'Add names to completion objects. Latin alphanumerics + underscore only.' },
    { value: 2,  label: 'Message Content', hint: 'Prepend names to message contents.' },
  ] as const;

  const POSTFIX_OPTS = [
    { value: 0, label: 'None' },
    { value: 1, label: 'Space' },
    { value: 2, label: 'Newline' },
    { value: 3, label: 'Double Newline' },
  ] as const;

  const TOGGLES: { key: keyof PresetBehavior; label: string; desc: string }[] = [
    { key: 'continue_prefill', label: 'Continue prefill',
      desc: 'Continue sends the last message as assistant role instead of system message with instruction.' },
    { key: 'squash_system_messages', label: 'Squash system messages',
      desc: 'Combines consecutive system messages into one (excluding example dialogues). May improve coherence for some models.' },
    { key: 'use_sysprompt', label: 'Use system prompt',
      desc: 'Send the system prompt for supported models. If disabled, the user message is added to the beginning of the prompt.' },
    { key: 'enable_web_search', label: 'Enable web search',
      desc: 'Use search capabilities provided by the backend.' },
    { key: 'function_calling', label: 'Enable function calling',
      desc: 'Allows using function tools. Can be utilized by various extensions.' },
    { key: 'image_inlining', label: 'Send inline media',
      desc: 'Sends attached media in prompts if supported by the model.' },
    { key: 'show_thoughts', label: 'Request model reasoning',
      desc: 'Allows the model to return its thinking process. This setting affects visibility only.' },
  ];

  const namesLabel = $derived(NAMES_OPTS.find((o) => o.value === b?.names_behavior)?.label ?? '');
  const postfixLabel = $derived(POSTFIX_OPTS.find((o) => o.value === b?.continue_postfix)?.label ?? '');
</script>

{#if b && t}
  <div class="flex flex-col gap-2">
    <!-- ── Character Names Behavior ─────────────────────────────────────── -->
    <InlineDrawer title="Character Names Behavior" subtitle={namesLabel} key="behavior-names">
      {#each NAMES_OPTS as opt (opt.value)}
        <label class="flex items-start gap-2 cursor-pointer">
          <input type="radio" name="names-behavior" class="mt-1 accent-quote"
            checked={b.names_behavior === opt.value}
            onchange={() => preset.setBehavior('names_behavior', opt.value)} />
          <span class="flex flex-col">
            <span class="text-sm">{opt.label}</span>
            <span class="text-xs opacity-50">{opt.hint}</span>
          </span>
        </label>
      {/each}
    </InlineDrawer>

    <!-- ── Continue Postfix ─────────────────────────────────────────────── -->
    <InlineDrawer title="Continue Postfix" subtitle={postfixLabel} key="behavior-postfix">
      {#each POSTFIX_OPTS as opt (opt.value)}
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="continue-postfix" class="accent-quote"
            checked={b.continue_postfix === opt.value}
            onchange={() => preset.setBehavior('continue_postfix', opt.value)} />
          <span class="text-sm">{opt.label}</span>
        </label>
      {/each}
    </InlineDrawer>

    <!-- ── Toggles ──────────────────────────────────────────────────────── -->
    {#each TOGGLES as tg (tg.key)}
      <div>
        <Toggle
          label={tg.label}
          checked={b[tg.key] as boolean}
          onchange={(v) => preset.setBehavior(tg.key, v)}
        />
        <p class="text-xs opacity-50 mt-0.5 ml-6">{tg.desc}</p>
      </div>
    {/each}

    <!-- ── Reasoning + Verbosity ────────────────────────────────────────── -->
    <Field label="Reasoning Effort">
      <Select
        value={b.reasoning_effort}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'min', label: 'Minimum' },
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'max', label: 'Maximum' },
        ]}
        onchange={(v) => preset.setBehavior('reasoning_effort', v as PresetBehavior['reasoning_effort'])}
      />
    </Field>
    <p class="text-xs opacity-50 -mt-1">
      Allocates a portion of the response length for thinking (min: 1024, low: 10%,
      medium: 25%, high: 50%, max: 95%), but minimum 1024 tokens. Auto does not
      request thinking.
    </p>
    <p class="text-xs opacity-50">
      On Opus 4.6 / Sonnet 4.6, a non-automatic Reasoning Effort takes precedence over Verbosity.
    </p>

    <Field label="Verbosity">
      <Select
        value={b.verbosity}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ]}
        onchange={(v) => preset.setBehavior('verbosity', v as PresetBehavior['verbosity'])}
      />
    </Field>

    <!-- ── Prefills ─────────────────────────────────────────────────────── -->
    <Field label="Assistant Prefill">
      <Textarea rows={2} placeholder="Start Claude's answer with…"
        value={t.assistant_prefill}
        onblur={(e) => preset.setTemplate('assistant_prefill', (e.currentTarget as HTMLTextAreaElement).value)} />
    </Field>

    <Field label="Assistant Impersonation Prefill">
      <Textarea rows={2} placeholder="Start Claude's answer with…"
        value={t.assistant_impersonation}
        onblur={(e) => preset.setTemplate('assistant_impersonation', (e.currentTarget as HTMLTextAreaElement).value)} />
    </Field>
  </div>
{/if}
