<script lang="ts">
  import { val } from '$lib/utils/dom';

  interface Option { value: string; label: string }

  interface Props {
    value?: string;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    onchange?: (value: string) => void;
  }

  let { value = $bindable(''), options, placeholder, disabled = false, class: cls = '', onchange }: Props = $props();
</script>

<select
  bind:value
  {disabled}
  class="text-pole {cls}"
  onchange={(e) => onchange?.(val(e))}
>
  {#if placeholder}<option value="" disabled>{placeholder}</option>{/if}
  {#each options as opt (opt.value)}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
