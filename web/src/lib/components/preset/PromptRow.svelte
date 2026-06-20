<!--
  One row in the prompt order list. Grid: handle | type+name | controls | tokens.
  ST css: 4fr 80px 45px, padding 0.5em, border var(--SmartThemeBorderColor).

  Type icon classification (ST renderPromptManagerListItems lines 1701–1717):
  first match wins.
-->
<script lang="ts">
  import type { PromptDefinition } from '$lib/api/types';
  import { canDetach, canEdit } from '$lib/core/preset-defaults';

  interface Props {
    prompt: PromptDefinition;
    enabled: boolean;
    tokens: number;
    /** Char card is currently overriding this prompt's content. */
    overridden?: boolean;
    ontoggle?: () => void;
    onedit?: () => void;
    ondetach?: () => void;
    oninspect?: () => void;
  }

  let { prompt, enabled, tokens, overridden = false, ontoggle, onedit, ondetach, oninspect }: Props = $props();

  // First match wins. Order matters.
  type IconClass = { icon: string; title: string };
  const typeIcon = $derived.by((): IconClass => {
    if (prompt.injection_position === 1) return { icon: 'syringe', title: 'In-Chat Injection' };
    if (prompt.marker) return { icon: 'thumbtack', title: 'Marker' };
    if (prompt.system_prompt && prompt.forbid_overrides) return { icon: 'star', title: 'Important Prompt' };
    if (prompt.system_prompt) return { icon: 'square-poll-horizontal', title: 'Global Prompt' };
    return { icon: 'asterisk', title: 'Preset Prompt' };
  });

  const detachable = $derived(canDetach(prompt));
  const editable = $derived(canEdit(prompt));
</script>

<li
  class="grid grid-cols-[16px_1fr_80px_50px] items-center gap-2 p-2 border rounded
         {enabled ? 'border-st-border' : 'border-white/20'}"
>
  <!-- Drag handle. ST uses U+2630 ☰; we use grip-vertical for the cursor. -->
  <span
    class="i-fa6-solid:grip-vertical text-xs opacity-30 cursor-grab"
    aria-label="Drag to reorder"
  ></span>

  <!-- Name + badges -->
  <span class="flex items-center gap-1.5 min-w-0">
    <span
      class="i-fa6-solid:{typeIcon.icon} text-xs opacity-50 flex-shrink-0"
      title={typeIcon.title}
    ></span>
    <button
      type="button"
      class="text-left text-sm truncate hover:underline {enabled ? '' : 'opacity-30'}"
      class:font-semibold={prompt.forbid_overrides}
      onclick={oninspect}
      title={prompt.content || prompt.name}
    >
      {prompt.name || prompt.identifier}
    </button>

    <!-- Role icon: only when not system. ST suppresses for marker+system
         (avoids robot icon on Chat History). -->
    {#if prompt.role === 'assistant' && !(prompt.marker && prompt.system_prompt)}
      <span class="i-fa6-solid:robot text-xs opacity-50" title="Assistant role"></span>
    {:else if prompt.role === 'user' && !(prompt.marker && prompt.system_prompt)}
      <span class="i-fa6-solid:user text-xs opacity-50" title="User role"></span>
    {/if}

    <!-- Depth badge: only for absolute injection -->
    {#if prompt.injection_position === 1}
      <span class="text-xs opacity-50 flex-shrink-0">@ {prompt.injection_depth}</span>
    {/if}

    <!-- Override badge -->
    {#if overridden}
      <span class="i-fa6-solid:address-card text-xs text-quote flex-shrink-0"
        title="Pulled from a character card"></span>
    {/if}
  </span>

  <!-- Controls. 18×18 box, opacity .4 → 1 on hover, drop-shadow. -->
  <span class="flex justify-between items-center">
    {#if detachable}
      <button type="button"
        class="i-fa6-solid:link-slash text-xs text-red-400 opacity-40 hover:opacity-100
               drop-shadow-[0_0_2px_black] transition-opacity"
        title="Remove" onclick={ondetach}></button>
    {:else}
      <!-- Empty span keeps grid alignment when button is hidden. -->
      <span class="w-3"></span>
    {/if}

    {#if editable}
      <button type="button"
        class="i-fa6-solid:pencil text-xs opacity-40 hover:opacity-100
               drop-shadow-[0_0_2px_black] transition-opacity"
        title="Edit" onclick={onedit}></button>
    {:else}
      <span class="w-3"></span>
    {/if}

    <button type="button"
      class="text-sm opacity-40 hover:opacity-100 drop-shadow-[0_0_2px_black] transition-opacity
             {enabled ? 'i-fa6-solid:toggle-on text-quote' : 'i-fa6-solid:toggle-off'}"
      title={enabled ? 'Enabled' : 'Disabled'}
      onclick={ontoggle}></button>
  </span>

  <!-- Tokens. ST shows '-' not '0'. -->
  <span class="text-xs text-right opacity-50 tabular-nums">
    {tokens > 0 ? tokens : '-'}
  </span>
</li>
