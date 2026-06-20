<!--
  The action strip — top-right of the header. Two persistent icons (`[…][✎]`)
  with the rest sliding in on ellipsis click. expand_actions skips the
  ellipsis for power users.

  ST drives this with a jQuery $.transition({opacity:0}) chain plus a
  document click listener (script.js ~10800). One $state + clickOutside +
  svelte's slide transition do the same in 30 lines.

  The flag (checkpoint indicator) and pencil (edit) live OUTSIDE the
  expanding strip — they're the persistent two. They sit after
  .extraMesButtons in DOM order so they don't move when the strip slides.
-->
<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { Message } from '$lib/api/types';
  import { chat } from '$lib/state/chat.svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { toasts } from '$lib/state/toast.svelte';
  import { clickOutside } from '$lib/actions/click-outside';

  interface Props {
    message: Message;
    index: number;
    isLast: boolean;
    onedit: () => void;
  }

  let { message, index, isLast, onedit }: Props = $props();

  let expanded = $state(false);

  const T = $derived(theme.toggles);
  const showExtra = $derived(expanded || T.expand_actions);

  function copy(): void {
    navigator.clipboard.writeText(message.content)
      .then(() => toasts.success('Copied'))
      .catch(() => {});
  }

  function openCheckpoint(): void {
    const link = message.extra.bookmark_link;
    if (link) chat.open(link).catch((e) => toasts.error(String(e)));
  }

  // Attachments: open a file picker, POST to /api/attachments, append the
  // returned URL to extra.attachments. The picker is a one-shot <input>
  // appended to the DOM and clicked — no need to keep one bound.
  function attachFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const form = new FormData();
      form.set('file', file);
      try {
        const res = await fetch('/api/attachments', { method: 'POST', body: form });
        if (!res.ok) throw new Error(res.statusText);
        const { url } = await res.json() as { url: string };
        const attachments = [...(message.extra.attachments ?? []), url];
        await chat.patchMessage(message.id, { extra: { ...message.extra, attachments } });
        toasts.success('File attached');
      } catch (e) {
        toasts.error(`Attach failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    input.click();
  }
</script>

<div class="mes_buttons flex items-center gap-1 flex-shrink-0"
     use:clickOutside={() => expanded = false}>

  {#if !T.expand_actions}
    <button class="mes-btn i-fa6-solid:ellipsis"
      class:opacity-0={expanded}
      class:pointer-events-none={expanded}
      onclick={() => expanded = !expanded}
      title="Message actions"></button>
  {/if}

  {#if showExtra}
    <div class="extraMesButtons flex items-center gap-1"
         transition:slide={{ axis: 'x', duration: 150 }}>
      <button class="mes-btn"
        class:i-fa6-solid:eye={message.is_hidden}
        class:i-fa6-solid:eye-slash={!message.is_hidden}
        onclick={() => chat.hideMessage(message.id, !message.is_hidden)}
        title={message.is_hidden ? 'Unhide' : 'Hide'}></button>

      <button class="mes-btn i-fa6-solid:paperclip"
        onclick={attachFile}
        title="Attach file"></button>

      <button class="mes-btn i-fa6-solid:flag-checkered"
        onclick={() => chat.branch(message.id, { checkpoint: true })}
        title="Create checkpoint"></button>

      <button class="mes-btn i-fa6-solid:code-branch"
        onclick={() => chat.branch(message.id)}
        title="Branch from here"></button>

      <button class="mes-btn i-fa6-solid:copy"
        onclick={copy}
        title="Copy text"></button>

      {#if isLast && message.role === 'assistant' && chat.lastPrompt}
        <button class="mes-btn i-fa6-solid:square-poll-horizontal"
          onclick={() => toasts.info('Prompt itemizer — TODO')}
          title="Prompt breakdown"></button>
      {/if}
    </div>
  {/if}

  {#if message.extra.bookmark_link}
    <button class="mes-btn i-fa6-solid:flag text-quote"
      onclick={openCheckpoint}
      title="Open checkpoint chat"></button>
  {/if}

  <button class="mes-btn i-fa6-solid:pencil"
    onclick={onedit}
    title="Edit"></button>
</div>
