<!--
  Advanced character editor. The fields you scroll past on the way to Save in
  the inline panel — personality, scenario, mes_example, prompt overrides,
  depth_prompt, creator metadata — get a full-width overlay here.

  No draft. Binds live to characters.active.data, same as the inline fields.
  A draft would mean two save paths (inline writes immediately, popup buffers)
  and the user model is "I'm editing the same character."

  Resizable corner; size persists under 'popup.charAdvanced'.
-->
<script module lang="ts">
  let open = $state(false);
  export const charAdvanced = {
    get open() { return open; },
    show() { open = true; },
    close() { open = false; },
  };
</script>

<script lang="ts">
  import { fade } from 'svelte/transition';
  import InlineDrawer from '../ui/InlineDrawer.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Field from '../ui/Field.svelte';
  import Input from '../ui/Input.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import Select from '../ui/Select.svelte';
  import { characters } from '$lib/state/characters.svelte';
  import { resize } from '$lib/actions/resize';
  import { estimateTokens } from '$lib/core/tokenize';
  import { val } from '$lib/utils/dom';
  import type { CardData, DepthPrompt } from '$lib/api/types';

  function patch<K extends keyof CardData>(key: K, value: CardData[K]): void {
    const c = characters.active;
    if (!c) return;
    c.data[key] = value;
    characters.saveData(c.id, { ...c.data });
  }

  /** Lazy-init depth_prompt. Cards without it don't grow it until first edit. */
  function depthPrompt(): DepthPrompt {
    const c = characters.active!;
    if (!c.data.extensions.depth_prompt) {
      c.data.extensions.depth_prompt = { prompt: '', depth: 4, role: 'system' };
    }
    return c.data.extensions.depth_prompt;
  }

  function patchDepth<K extends keyof DepthPrompt>(key: K, value: DepthPrompt[K]): void {
    const c = characters.active;
    if (!c) return;
    depthPrompt()[key] = value;
    characters.saveData(c.id, { ...c.data });
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') charAdvanced.close();
  }

  // Tag input is a comma-split. The V2 spec tags, not the local tag system.
  function patchTags(s: string) {
    patch('tags', s.split(',').map((t) => t.trim()).filter(Boolean));
  }
</script>

{#if open && characters.active}
  {@const c = characters.active}
  {@const dp = c.data.extensions.depth_prompt}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-9000 bg-black/60 flex items-center justify-center p-4"
    transition:fade={{ duration: 100 }}
    onkeydown={onkey}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div
      class="panel-chrome backdrop-blur-md flex flex-col w-full h-full max-w-4xl max-h-[90vh]"
      use:resize={{ axis: 'both', key: 'popup.charAdvanced' }}
    >
      <header class="flex justify-between items-center p-3 border-b border-st-border flex-shrink-0">
        <h3 class="font-bold text-lg m-0">{c.data.name} — Advanced</h3>
        <IconButton icon="xmark" size="sm" title="Close" onclick={charAdvanced.close} />
      </header>

      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <!-- ── Prompt Overrides ───────────────────────────────────────── -->
        <InlineDrawer title="Prompt Overrides" key="char.advanced.overrides" defaultOpen>
          <Field label="System prompt" hint="Replaces preset main. Empty = use preset"
            tokens={estimateTokens(c.data.system_prompt)}>
            <Textarea value={c.data.system_prompt}
              oninput={(e) => patch('system_prompt', val(e))} rows={3} />
          </Field>
          <Field label="Post-history instructions" hint="Replaces preset jailbreak"
            tokens={estimateTokens(c.data.post_history_instructions)}>
            <Textarea value={c.data.post_history_instructions}
              oninput={(e) => patch('post_history_instructions', val(e))} rows={3} />
          </Field>
        </InlineDrawer>

        <!-- ── Card Definition ────────────────────────────────────────── -->
        <InlineDrawer title="Card Definition" key="char.advanced.definition" defaultOpen>
          <Field label="Personality summary" tokens={estimateTokens(c.data.personality)}>
            <Textarea value={c.data.personality}
              oninput={(e) => patch('personality', val(e))} rows={2} />
          </Field>
          <Field label="Scenario" tokens={estimateTokens(c.data.scenario)}>
            <Textarea value={c.data.scenario}
              oninput={(e) => patch('scenario', val(e))} rows={2} />
          </Field>
          <Field label="Examples of dialogue" tokens={estimateTokens(c.data.mes_example)}>
            <Textarea value={c.data.mes_example}
              oninput={(e) => patch('mes_example', val(e))}
              sizeKey="char.mes_example" rows={6}
              placeholder={'<START>\n{{user}}: ...\n{{char}}: ...'} />
          </Field>
        </InlineDrawer>

        <!-- ── Character's Note ───────────────────────────────────────── -->
        <InlineDrawer title="Character's Note" key="char.advanced.note"
          subtitle="@ Depth"
          info="Injected into chat history at the given depth — like a per-character author's note">
          <div class="flex gap-3 items-start">
            <div class="flex-1">
              <Textarea value={dp?.prompt ?? ''}
                oninput={(e) => patchDepth('prompt', val(e))} rows={3}
                placeholder="(Injected into chat history at the given depth)" />
              <div class="text-right text-xs opacity-40 mt-1">
                {estimateTokens(dp?.prompt ?? '')}t
              </div>
            </div>
            <div class="flex flex-col gap-2 w-28">
              <label class="flex flex-col gap-1">
                <span class="text-xs opacity-70">Depth</span>
                <input type="number" class="text-pole" min="0"
                  value={dp?.depth ?? 4}
                  oninput={(e) => patchDepth('depth', Number(val(e)) || 0)} />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs opacity-70">Role</span>
                <Select
                  value={dp?.role ?? 'system'}
                  options={[
                    { value: 'system', label: 'System' },
                    { value: 'user', label: 'User' },
                    { value: 'assistant', label: 'Assistant' },
                  ]}
                  onchange={(v) => patchDepth('role', v as DepthPrompt['role'])}
                />
              </label>
            </div>
          </div>
        </InlineDrawer>

        <!-- ── Creator Metadata ───────────────────────────────────────── -->
        <InlineDrawer title="Creator Metadata" key="char.advanced.creator">
          <div class="flex gap-3">
            <Field label="Creator">
              <Input value={c.data.creator} oninput={(e) => patch('creator', val(e))} />
            </Field>
            <Field label="Version">
              <Input value={c.data.character_version}
                oninput={(e) => patch('character_version', val(e))} />
            </Field>
          </div>
          <Field label="Creator notes" hint="Not sent to model">
            <Textarea value={c.data.creator_notes}
              oninput={(e) => patch('creator_notes', val(e))} rows={3} />
          </Field>
          <Field label="Card tags" hint="V2 spec tags, comma-separated">
            <Input value={c.data.tags.join(', ')} oninput={(e) => patchTags(val(e))} />
          </Field>
        </InlineDrawer>
      </div>
    </div>
  </div>
{/if}
