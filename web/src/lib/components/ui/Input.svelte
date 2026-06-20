<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  // Omit value so $bindable doesn't conflict with the readonly DOM type.
  interface Props extends Omit<HTMLInputAttributes, 'value'> {
    value?: string;
  }

  let { value = $bindable(''), class: cls = '', ...rest }: Props = $props();
</script>

<input bind:value class="text-pole {cls}" {...rest} />
