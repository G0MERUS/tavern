<!--
  Context budget + sampler knobs. The top-level controls (context, response,
  stream, temp, top_k, top_p) are always visible. The rarer ones live behind
  an "Advanced Samplers" InlineDrawer collapsed by default.

  The unlock toggle rebinds the context slider's max from 8K to 2M.
-->
<script lang="ts">
  import Slider from '../ui/Slider.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import InlineDrawer from '../ui/InlineDrawer.svelte';
  import { preset } from '$lib/state/preset.svelte';

  const s = $derived(preset.active?.samplers);

  const contextMax = $derived(s?.max_context_unlocked ? 2_000_000 : 8192);
  // ST doesn't clamp response to context/2 but should — a 200K-token response
  // on a 200K context is nonsense.
  const responseMax = $derived(Math.max(16, Math.floor((s?.openai_max_context ?? 8192) / 2)));
</script>

{#if s}
  <div class="flex flex-col gap-2">
    <Toggle
      label="Unlocked Context Size"
      checked={s.max_context_unlocked}
      onchange={(v) => preset.setSampler('max_context_unlocked', v)}
    />

    <Slider label="Context Size (tokens)"
      value={s.openai_max_context} min={512} max={contextMax} step={1024}
      onchange={(v) => preset.setSampler('openai_max_context', v)} />

    <Slider label="Max Response Length (tokens)"
      value={s.openai_max_tokens} min={16} max={responseMax} step={16}
      onchange={(v) => preset.setSampler('openai_max_tokens', v)} />

    <Toggle
      label="Streaming"
      checked={s.stream}
      onchange={(v) => preset.setSampler('stream', v)}
    />
    <p class="text-xs opacity-50 -mt-1">Display the response bit by bit as it is generated.</p>

    <Slider label="Temperature"
      value={s.temperature} min={0} max={2} step={0.01}
      onchange={(v) => preset.setSampler('temperature', v)} />

    <Slider label="Top K"
      value={s.top_k} min={0} max={500} step={1}
      onchange={(v) => preset.setSampler('top_k', v)} />

    <Slider label="Top P"
      value={s.top_p} min={0} max={1} step={0.01}
      onchange={(v) => preset.setSampler('top_p', v)} />

    <InlineDrawer title="Advanced Samplers" key="samplers-advanced">
      <Slider label="Min P"
        value={s.min_p} min={0} max={1} step={0.01}
        onchange={(v) => preset.setSampler('min_p', v)} />

      <Slider label="Top A"
        value={s.top_a} min={0} max={1} step={0.01}
        onchange={(v) => preset.setSampler('top_a', v)} />

      <Slider label="Frequency Penalty"
        value={s.frequency_penalty} min={-2} max={2} step={0.01}
        onchange={(v) => preset.setSampler('frequency_penalty', v)} />

      <Slider label="Presence Penalty"
        value={s.presence_penalty} min={-2} max={2} step={0.01}
        onchange={(v) => preset.setSampler('presence_penalty', v)} />

      <Slider label="Repetition Penalty"
        value={s.repetition_penalty} min={1} max={2} step={0.01}
        onchange={(v) => preset.setSampler('repetition_penalty', v)} />

      <Slider label="Seed"
        value={s.seed} min={-1} max={999999} step={1}
        onchange={(v) => preset.setSampler('seed', v)} />
      <p class="text-xs opacity-50 -mt-1">-1 = random</p>

      <Slider label="N (multi-swipe)"
        value={s.n} min={1} max={10} step={1}
        onchange={(v) => preset.setSampler('n', v)} />
    </InlineDrawer>
  </div>
{/if}
