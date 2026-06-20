<!--
  #options — the hamburger-anchored action popup. ST's #options menu
  flattened to seven items; the rest moved (Author's Note → floating panel,
  Manage chat files → Characters drawer, Convert to group → cut) or are
  extension surfaces we don't own (CFG Scale, Token Probabilities).

  Positioning: absolute bottom-full left-0 anchored to #leftSendForm inside
  #send-form (which is position:relative). z-50 clears #sheld (z-30);
  drawers (z-3500+) intentionally cover us — clicking a drawer icon fires
  click-outside here before the drawer animation starts.

  Dismissal:
    - click outside (guarded so the opener button re-toggles, not re-closes)
    - Escape (local window listener, not ui.closeTop — that's for drawers)
    - clicking any item (run() closes before awaiting)
-->
<script lang="ts">
  import { slide } from 'svelte/transition';
  import { clickOutside } from '$lib/actions/click-outside';
  import { chat } from '$lib/state/chat.svelte';
  import { characters } from '$lib/state/characters.svelte';

  interface Props { open: boolean }
  let { open = $bindable() }: Props = $props();

  // Derived affordances. The menu's disabled state is a function of chat
  // shape; deriving here keeps the $state minimal.
  const lastBot = $derived(chat.isLastMessageBot);
  const hasMsgs = $derived(chat.messages.length > 0);
  const hasChar = $derived(!!characters.active);
  const hasChat = $derived(!!chat.active);
  const streaming = $derived(chat.streaming.active);

  /** Close first, then run. Prevents the popup sitting open over a toast
      while an action awaits the server. Errors are the action's job. */
  function run(fn: () => unknown) {
    return async () => {
      open = false;
      await fn();
    };
  }

  async function saveCheckpoint() {
    const last = chat.messages.at(-1);
    if (!last) return;
    await chat.branch(last.id, { checkpoint: true });
  }

  async function startNew() {
    if (!characters.active) return;
    await chat.startNew(characters.active.id);
  }

  function closeChat() {
    chat.close();
  }

  function deleteMessages() {
    chat.enterDeleteMode();
  }

  async function regenerate() { await chat.generate('regenerate'); }
  async function impersonate() { await chat.generate('impersonate'); }
  async function continueMsg() { await chat.generate('continue'); }

  // Local Escape — ui.closeTop() is drawer-scoped.
  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      open = false;
    }
  }
</script>

<svelte:window onkeydown={onkey} />

{#if open}
  <div
    id="options"
    role="menu"
    class="absolute bottom-full left-0 mb-1 z-50
           panel-chrome backdrop-blur-[var(--SmartThemeBlurStrength)]
           py-1 min-w-52 shadow-lg"
    transition:slide={{ axis: 'y', duration: 120 }}
    use:clickOutside={(e) => {
      // Opener lives outside the popup but toggles us \u2014 let the toggle win.
      if ((e.target as HTMLElement).closest('#options_button')) return;
      open = false;
    }}
  >
    <button class="options-item" onclick={run(saveCheckpoint)}
      disabled={!hasChat || !hasMsgs}>
      <span class="i-fa6-solid:flag"></span> Save checkpoint
    </button>

    <div class="options-sep"></div>

    <button class="options-item" onclick={run(startNew)}
      disabled={!hasChar}>
      <span class="i-fa6-solid:comments"></span> Start new chat
    </button>
    <button class="options-item" onclick={run(closeChat)}
      disabled={!hasChat}>
      <span class="i-fa6-solid:xmark"></span> Close chat
    </button>

    <div class="options-sep"></div>

    <button class="options-item" onclick={run(deleteMessages)}
      disabled={!hasMsgs}>
      <span class="i-fa6-solid:trash-can"></span> Delete messages
    </button>
    <button class="options-item" onclick={run(regenerate)}
      disabled={!lastBot || streaming}>
      <span class="i-fa6-solid:rotate"></span> Regenerate
    </button>
    <button class="options-item" onclick={run(impersonate)}
      disabled={!hasChat || streaming}>
      <span class="i-fa6-solid:user-secret"></span> Impersonate
    </button>
    <button class="options-item" onclick={run(continueMsg)}
      disabled={!lastBot || streaming}>
      <span class="i-fa6-solid:arrow-right"></span> Continue
    </button>
  </div>
{/if}
