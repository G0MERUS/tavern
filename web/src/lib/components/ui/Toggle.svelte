<script lang="ts">
  import { checked as readChecked } from '$lib/utils/dom';

  interface Props {
    checked?: boolean;
    label?: string;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
  }

  let { checked = $bindable(false), label, disabled = false, onchange }: Props = $props();
</script>

<label class="flex items-center gap-2 cursor-pointer select-none" class:opacity-50={disabled}>
  <input
    type="checkbox"
    bind:checked
    {disabled}
    onchange={(e) => onchange?.(readChecked(e))}
    class="w-4 h-4 accent-quote cursor-pointer"
  />
  {#if label}<span class="text-sm">{label}</span>{/if}
</label>
