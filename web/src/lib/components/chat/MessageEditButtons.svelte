<!--
  The seven-icon edit strip. Replaces MessageButtons while editing — the
  header stays put, only the right cluster swaps. ST puts these in
  .menu_button shells; the screenshot shows them flat. Going flat — less
  visual jolt on edit-enter.

  .mes-edit-btn rests at 0.5 (vs .mes-btn's 0.3): you're already in a mode,
  the affordances should be more visible.
-->
<script lang="ts">
  import type { Message } from '$lib/api/types';
  import { chat } from '$lib/state/chat.svelte';
  import { settings } from '$lib/state/settings.svelte';
  import { dialog } from '$lib/state/dialog.svelte';

  interface Props {
    message: Message;
    index: number;
    isLast: boolean;
    onsave: () => void;
    oncancel: () => void;
  }

  let { message, index, isLast, onsave, oncancel }: Props = $props();

  async function del(): Promise<void> {
    if (settings.confirmDelete) {
      if (!(await dialog.confirm('Delete this message?'))) return;
    }
    oncancel();
    await chat.deleteMessage(message.id);
  }

  // Stamp an empty reasoning string so the <details> appears; the user types
  // into it. Disabled when reasoning already exists (button would no-op).
  async function addReasoning(): Promise<void> {
    if (message.extra.reasoning != null) return;
    await chat.patchMessage(message.id, { extra: { ...message.extra, reasoning: '' } });
  }
</script>

<div class="mes_edit_buttons flex items-center gap-1 flex-shrink-0">
  <button class="mes-edit-btn i-fa6-solid:check !text-green-400"
    onclick={onsave} title="Confirm"></button>

  <button class="mes-edit-btn i-fa6-solid:copy"
    onclick={() => chat.duplicateMessage(message.id)}
    title="Copy as new message"></button>

  <button class="mes-edit-btn i-fa6-solid:lightbulb"
    onclick={addReasoning}
    disabled={message.extra.reasoning != null}
    title="Add reasoning block"></button>

  <button class="mes-edit-btn i-fa6-solid:trash-can text-crimson"
    onclick={del} title="Delete"></button>

  <button class="mes-edit-btn i-fa6-solid:chevron-up"
    onclick={() => chat.moveMessage(message.id, -1)}
    disabled={index === 0}
    title="Move up"></button>

  <button class="mes-edit-btn i-fa6-solid:chevron-down"
    onclick={() => chat.moveMessage(message.id, +1)}
    disabled={isLast}
    title="Move down"></button>

  <button class="mes-edit-btn i-fa6-solid:xmark"
    onclick={oncancel} title="Cancel"></button>
</div>
