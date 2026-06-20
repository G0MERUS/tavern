<!--
  Swipe gallery. ST's mes_swipe_picker (the bookmark icon). Making the
  swipe-counter itself the trigger means one less header icon and the
  counter already implies "there's more here."

  Singleton popup — module state instead of props so SwipeControls doesn't
  have to bubble through Message → Sheld → App to mount one. Same pattern
  as Greetings.svelte. The message lookup re-runs on every chat.messages
  mutation, so a deleteSwipe response landing while the popup is open
  re-renders the row list.
-->
<script module lang="ts">
  let open = $state(false);
  let messageId = $state<string | null>(null);

  export const swipePicker = {
    get open() { return open; },
    show(id: string) { messageId = id; open = true; },
    close() { open = false; messageId = null; },
  };
</script>

<script lang="ts">
  import { fade } from 'svelte/transition';
  import { chat } from '$lib/state/chat.svelte';
  import { dialog } from '$lib/state/dialog.svelte';
  import IconButton from '../ui/IconButton.svelte';

  const message = $derived(
    messageId ? chat.messages.find((m) => m.id === messageId) : undefined
  );

  function preview(s: string): string {
    const t = s.trim();
    return t.length > 200 ? t.slice(0, 200) + '…' : t;
  }

  async function activate(i: number): Promise<void> {
    const m = message;
    if (!m) return;
    const target = m.swipes[i];
    await chat.patchMessage(m.id, {
      swipe_idx: i,
      content: target?.content ?? m.content,
      extra: { ...m.extra, ...(target?.extra ?? {}) },
    });
    swipePicker.close();
  }

  async function del(i: number): Promise<void> {
    const m = message;
    if (!m || m.swipes.length <= 1) return;
    if (!(await dialog.confirm('Delete this swipe?'))) return;
    await chat.deleteSwipe(m.id, i);
    // If we just deleted the last one standing, close. Otherwise stay open —
    // the $derived re-reads the updated message.
    if (m.swipes.length <= 1) swipePicker.close();
  }

  function onkey(e: KeyboardEvent): void {
    if (e.key === 'Escape') swipePicker.close();
  }
</script>

{#if open && message}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-9000 bg-black/60 flex items-center justify-center p-4"
    transition:fade={{ duration: 100 }}
    onkeydown={onkey}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="panel-chrome backdrop-blur-md flex flex-col w-full max-w-2xl max-h-[80vh]">
      <header class="flex justify-between items-center p-3 border-b border-st-border flex-shrink-0">
        <h3 class="font-bold m-0">Swipes ({message.swipes.length})</h3>
        <IconButton icon="xmark" size="sm" title="Close" onclick={swipePicker.close} />
      </header>

      <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {#each message.swipes as swipe, i (i)}
          <div
            class="flex flex-col gap-1 p-2 border rounded"
            class:border-quote={i === message.swipe_idx}
            class:border-st-border={i !== message.swipe_idx}
          >
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="font-bold opacity-70">
                #{i + 1}
                {#if i === message.swipe_idx}<span class="text-quote ml-1">● active</span>{/if}
              </span>
              <span class="flex items-center gap-2">
                {#if swipe.model}
                  <span class="opacity-40 truncate max-w-40">{swipe.model}</span>
                {/if}
                <IconButton icon="check" size="sm" title="Activate"
                  disabled={i === message.swipe_idx}
                  onclick={() => activate(i)} />
                <IconButton icon="trash-can" size="sm" title="Delete"
                  class="!text-red-400"
                  disabled={message.swipes.length <= 1}
                  onclick={() => del(i)} />
              </span>
            </div>
            <div class="text-sm opacity-80 whitespace-pre-wrap break-words">
              {preview(swipe.content)}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
