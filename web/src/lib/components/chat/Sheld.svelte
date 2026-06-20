<!--
  #sheld — the chat container. Hard constraint #3. Original ID kept verbatim
  (it's a typo of "shield" that's been there since 2022; user CSS targets it).

  Layout: fixed centered column, top-9 (under topbar) bottom-0, width
  --sheldWidth (clamp(min(95vw,500px), 60vw, 800px) — set in app.css).
  Messages scroll; send-form pinned to bottom.

  Auto-scroll: when a new message lands AND user is near bottom, scroll down.
  If user has scrolled up to read history, don't yank them. The "near bottom"
  threshold is 100px slop.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { chat } from '$lib/state/chat.svelte';
  import { settings } from '$lib/state/settings.svelte';
  import Message from './Message.svelte';
  import SendForm from './SendForm.svelte';
  import Button from '../ui/Button.svelte';

  let scroller: HTMLDivElement | undefined = $state();
  let pinned = true;  // user is at/near bottom

  function onscroll() {
    if (!scroller) return;
    const slack = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    pinned = slack < 100;
  }

  // Track message count + streaming content. Either changing → maybe scroll.
  // tick() waits for DOM update so scrollHeight is fresh.
  $effect(() => {
    chat.messages.length;
    chat.streaming.content;
    if (!settings.autoScroll || !pinned) return;
    tick().then(() => {
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
  });
</script>

<main
  id="sheld"
  class="fixed top-9 bottom-0 left-1/2 z-30 -translate-x-1/2
         w-[var(--sheldWidth)] flex flex-col
         bg-chat-tint backdrop-blur-[var(--SmartThemeBlurStrength)]"
>
  <div
    bind:this={scroller}
    {onscroll}
    class="flex-1 overflow-y-auto overflow-x-hidden"
  >
    {#if chat.messages.length === 0}
      <div class="h-full flex flex-col items-center justify-center gap-2 opacity-30">
        <span class="i-fa6-solid:comments text-4xl"></span>
        <span class="text-sm">No messages yet</span>
      </div>
    {:else}
      {#each chat.messages as msg, i (msg.id)}
        <Message message={msg} index={i} isLast={i === chat.messages.length - 1} />
      {/each}
    {/if}
  </div>

  {#if chat.deleteMode}
    <!-- Delete-mode banner. Sits above the send form so the delete/cancel
         affordances don't disappear under the textarea on long chats.
         crimson tint for the act-of-destruction cue. -->
    <div class="delete-banner flex items-center justify-between gap-2 px-3 py-2
                border-t border-crimson bg-crimson backdrop-blur-[var(--SmartThemeBlurStrength)]">
      <span class="text-sm">{chat.deleteSelection.size} selected</span>
      <div class="flex gap-2">
        <Button variant="danger"
          disabled={chat.deleteSelection.size === 0}
          onclick={() => chat.deleteSelected()}>
          Delete
        </Button>
        <Button onclick={() => chat.exitDeleteMode()}>Cancel</Button>
      </div>
    </div>
  {/if}

  <SendForm />
</main>
