<!--
  ‹ 1/3 › — inline group, bottom-right of .mes_block. Sits below the prose
  on its own reserved strip (padding-bottom on assistant .mes_block), so no
  right-gutter on .mes_text needed.

  Visibility is decided by CSS, not Svelte — the rules in app.css read
  .last_mes on the ancestor and body.swipeAllMessages. We always render and
  let the stylesheet hide. A 2000-message chat flips one body class instead
  of re-running 2000 components when swipe_count_all toggles.

  isGreeting suppresses the .last-swipe glow: at end-of-greetings, swipeRight
  loops to #0 instead of generating, so the "next click = generate" hint
  would lie.
-->
<script lang="ts">
  import type { Message } from '$lib/api/types';
  import { chat } from '$lib/state/chat.svelte';
  import { swipePicker } from '../popups/SwipePicker.svelte';

  interface Props {
    message: Message;
    isGreeting: boolean;
  }

  let { message, isGreeting }: Props = $props();

  const count = $derived(Math.max(message.swipes.length, 1));
  const idx = $derived(message.swipe_idx + 1);
  // Right chevron at end-of-swipes glows brighter (next click = generate).
  // ST's .last_swipe rule. Greetings don't generate, so don't glow.
  const atEnd = $derived(message.swipe_idx >= message.swipes.length - 1);
</script>

<div class="swipeRightBlock" class:last-swipe={atEnd && !isGreeting}>
  <button class="swipe_left mes-btn i-fa6-solid:chevron-left"
    onclick={() => chat.swipeLeft(message.id)}
    disabled={message.swipe_idx === 0}
    title="Previous swipe"></button>
  <button class="swipes-counter"
    onclick={count > 1 ? () => swipePicker.show(message.id) : undefined}
    disabled={count <= 1}
    title={count > 1 ? 'Pick swipe' : undefined}>
    {idx} / {count}
  </button>
  <button class="swipe_right mes-btn i-fa6-solid:chevron-right"
    onclick={() => chat.swipeRight(message.id)}
    title={atEnd && !isGreeting ? 'Generate new swipe' : 'Next swipe'}></button>
</div>
