<!--
  range-block: slider for coarse, number for precise. Shared $bindable.
-->
<script lang="ts">
  interface Props {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    disabled?: boolean;
    onchange?: (v: number) => void;
  }

  let { value = $bindable(0), min = 0, max = 1, step = 0.01, label, disabled = false, onchange }: Props = $props();

  const fire = () => onchange?.(value);
</script>

<div class="range-block" class:opacity-30={disabled} class:pointer-events-none={disabled}>
  {#if label}
    <div class="flex justify-between items-baseline">
      <span class="text-sm opacity-80">{label}</span>
      <input
        type="number"
        bind:value
        {min} {max} {step}
        onchange={fire}
        class="text-pole w-16 text-center text-xs"
      />
    </div>
  {/if}
  <input
    type="range"
    bind:value
    {min} {max} {step}
    onchange={fire}
    class="w-full accent-quote"
  />
</div>
