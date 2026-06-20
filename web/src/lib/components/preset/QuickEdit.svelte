<!--
  Aliases into the prompt pool. Editing here = editing in the prompt manager.
  ST PromptManager.js lines 727–755 + index.html 805–828.

  Two-way sync: if PromptEditPopup is open on the same identifier when this
  saves, close it (its draft is stale). ST does this implicitly via re-render.
-->
<script lang="ts">
  import Textarea from '../ui/Textarea.svelte';
  import InlineDrawer from '../ui/InlineDrawer.svelte';
  import { preset } from '$lib/state/preset.svelte';
  import { promptEditor } from './PromptEditPopup.svelte';

  const FIELDS = [
    { id: 'main', label: 'Main' },
    { id: 'nsfw', label: 'Auxiliary' },
    { id: 'jailbreak', label: 'Post-History Instructions' },
  ] as const;

  function save(identifier: string, content: string) {
    const p = preset.getPrompt(identifier);
    if (!p) return;
    preset.upsertPrompt({ ...p, content });
    // Close the editor popup if it's editing this same prompt — its local
    // draft is now stale.
    if (promptEditor.draft?.identifier === identifier) promptEditor.close();
  }
</script>

<InlineDrawer title="Quick Prompts Edit" key="quick-edit">
  {#each FIELDS as f (f.id)}
    {@const p = preset.getPrompt(f.id)}
    <div class="flex flex-col gap-1">
      <span class="text-sm opacity-80">{f.label}</span>
      <Textarea
        rows={6}
        maxHeight={300}
        placeholder="—"
        value={p?.content ?? ''}
        onblur={(e) => save(f.id, (e.currentTarget as HTMLTextAreaElement).value)}
      />
    </div>
  {/each}
</InlineDrawer>
