<!--
  ▸ Message Display
    [13 toggles, 2-col grid, divided by an <hr>]

  Top group: Message.svelte $derived reads. No CSS at all.
  Bottom group: body classes. theme.svelte.ts cascade $effect handles them.

  reduced_motion shows disabled when prefers-reduced-motion matches — the OS
  already set it, the toggle would lie. ST does this.
-->
<script lang="ts">
  import InlineDrawer from '../ui/InlineDrawer.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import { theme } from '$lib/state/theme.svelte';
  import type { ThemeToggles } from '$lib/api/types';

  // Component-read toggles (Message.svelte sinks).
  const MESSAGE: Array<{ key: keyof ThemeToggles; label: string }> = [
    { key: 'timestamps',      label: 'Timestamps' },
    { key: 'message_ids',     label: 'Message IDs' },
    { key: 'model_icon',      label: 'Model name' },
    { key: 'token_count',     label: 'Token count' },
    { key: 'gen_timer',       label: 'Generation timer' },
    { key: 'hide_avatars',    label: 'Hide avatars' },
    { key: 'expand_actions',  label: 'Expand actions' },
    { key: 'swipe_count_all', label: 'Swipe # on all' },
  ];

  // Body-class toggles.
  const PERF: Array<{ key: keyof ThemeToggles; label: string }> = [
    { key: 'reduced_motion', label: 'Reduced motion' },
    { key: 'no_blur',        label: 'No blur' },
    { key: 'no_shadows',     label: 'No text shadows' },
    { key: 'compact_input',  label: 'Compact input' },
  ];

  // matchMedia is sync; safe to evaluate once at construction.
  const osReducedMotion = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<InlineDrawer title="Message Display" key="theme.toggles">
  <div class="grid grid-cols-2 gap-x-4 gap-y-1">
    {#each MESSAGE as { key, label } (key)}
      <Toggle bind:checked={theme.active.toggles[key]} {label} onchange={theme.markDirty} />
    {/each}
  </div>

  <hr class="opacity-20 my-1" />

  <div class="grid grid-cols-2 gap-x-4 gap-y-1">
    {#each PERF as { key, label } (key)}
      <Toggle
        bind:checked={theme.active.toggles[key]}
        {label}
        disabled={key === 'reduced_motion' && osReducedMotion}
        onchange={theme.markDirty}
      />
    {/each}
  </div>
  {#if osReducedMotion}
    <span class="text-xs opacity-50">Reduced motion is set by your OS.</span>
  {/if}
</InlineDrawer>
