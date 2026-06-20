<!--
  Hard constraint #4. The send form: [options] textarea [send]. Enter sends
  (configurable), Shift+Enter newlines. While streaming, send button morphs
  into stop.

  Visual model: one bordered box that reads as a single text field. The
  textarea fills it; the option/send buttons are absolute-positioned against
  the inner box and vertically centered. The textarea carries left/right
  padding equal to the button gutter so typed text never flows under them.

  Top-edge grip. Auto-grows to 5 lines, then scrolls; drag for more. Drag
  persists under 'sendform' and locks auto-grow out. Double-click the grip
  to unlock. The grip attaches to the textarea's parent — which is now the
  inner box (not the form), so it still lives at the top edge of the visible
  border. compact_input becomes "default when not dragged."

  Left strip (#leftSendForm): the options hamburger. The popup (OptionsMenu)
  anchors absolute against #send-form (still position:relative), so moving
  the hamburger inside the inner box doesn't shift where the menu opens.

  Draft bridge: chat.draft (written by Impersonate's finalize) flows into
  text once, then clears. One-way; user typing never touches chat.draft.
-->
<script lang="ts">
  import { chat } from '$lib/state/chat.svelte';
  import { settings } from '$lib/state/settings.svelte';
  import { resize } from '$lib/actions/resize';
  import OptionsMenu from './OptionsMenu.svelte';

  let text = $state('');
  let el: HTMLTextAreaElement | undefined = $state();
  let optionsOpen = $state(false);
  // One-line height = drag floor = container's min. Measured once at mount
  // (rows=1, empty). Tracks fontScale; hardcoding 36 wouldn't.
  let lineH = $state(36);

  $effect(() => {
    if (el && lineH === 36) lineH = el.scrollHeight + 2;
  });

  $effect(() => {
    text;
    el?.__resize?.autosize(lineH * 5);
  });

  // Impersonate drops the drafted text into the textarea. Clear immediately
  // so subsequent renders don't re-apply the same draft, and focus so the
  // user can edit before sending.
  $effect(() => {
    if (chat.draft) {
      text = chat.draft;
      chat.setDraft('');
      queueMicrotask(() => el?.focus());
    }
  });

  async function send() {
    if (chat.streaming.active) return;
    const t = text.trim();
    if (!t) return;
    text = '';
    await chat.send(t);
  }

  function onkey(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const wantSend = settings.sendOnEnter
      ? !e.shiftKey && !e.ctrlKey
      : e.ctrlKey;
    if (wantSend) {
      e.preventDefault();
      send();
    }
  }
</script>

<form
  id="send-form"
  class="relative p-2 bg-blur-tint
         backdrop-blur-[var(--SmartThemeBlurStrength)] border-t border-st-border"
  onsubmit={(e) => { e.preventDefault(); send(); }}
>
  <!-- Inner box. Carries the border/bg that looks like a text field; inherits
       the text-pole focus ring via :focus-within so typing still feels like
       an input. position:relative so the absolute buttons and resize grip
       anchor to this box and not the form's padding. -->
  <div
    class="relative flex items-stretch bg-black/30 border border-st-border
           rounded-[calc(var(--panelRadius)*0.5)] transition-colors
           focus-within:border-body/50"
  >
    <!-- Left strip. Absolute so it floats over the textarea's padded gutter;
         vertically centered so it tracks the middle of the (possibly grown)
         box. z-1 clears the textarea's resize handle stacking. -->
    <div
      id="leftSendForm"
      class="absolute left-1 top-1/2 -translate-y-1/2 flex gap-1 z-1"
    >
      <button
        type="button"
        id="options_button"
        class="menu-btn-icon h-9 !border-transparent !bg-transparent"
        class:!text-quote={optionsOpen}
        onclick={() => optionsOpen = !optionsOpen}
        title="Chat options"
        aria-haspopup="menu"
        aria-expanded={optionsOpen}
      >
        <span class="i-fa6-solid:bars"></span>
      </button>
    </div>

    <!-- Textarea fills the box. pl-11/pr-11 reserves a 44px gutter on each
         side for the absolute buttons (h-9 = 36px + 4px offset + breathing).
         Border/bg stripped — the inner box owns the chrome now. -->
    <textarea
      bind:this={el}
      bind:value={text}
      use:resize={{ axis: 'y-grip', key: 'sendform', min: lineH, max: window.innerHeight * 0.5 }}
      onkeydown={onkey}
      placeholder={chat.active ? 'Type a message…' : 'Select a character to start'}
      disabled={!chat.active}
      rows="1"
      class="flex-1 block bg-transparent border-none outline-none text-body
             placeholder:(text-em opacity-70) disabled:opacity-50
             resize-none overflow-y-auto py-2 pl-11 pr-11"
    ></textarea>

    <!-- Right button. Symmetric to the left strip. Streaming: crimson stop;
         idle: transparent send that colors orange when there's text to send. -->
    {#if chat.streaming.active}
      <button
        type="button"
        class="absolute right-1 top-1/2 -translate-y-1/2 menu-btn-icon h-9
               !bg-crimson z-1"
        onclick={() => chat.stop()}
        title="Stop generation"
      >
        <span class="i-fa6-solid:stop"></span>
      </button>
    {:else}
      <button
        type="submit"
        class="absolute right-1 top-1/2 -translate-y-1/2 menu-btn-icon h-9
               !border-transparent !bg-transparent z-1"
        class:!text-quote={text.trim().length > 0}
        disabled={!chat.active || !text.trim()}
        title="Send"
      >
        <span class="i-fa6-solid:paper-plane"></span>
      </button>
    {/if}
  </div>

  <OptionsMenu bind:open={optionsOpen} />
</form>
