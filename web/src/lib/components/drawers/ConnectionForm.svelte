<!--
  Create/edit form, catalog-driven. Two modes, one component.

  Create mode: Provider combobox at the top drives kind + base_url + model
  options. Provider is NOT stored — it's a UI affordance for filling out the
  form. The connection row just has {kind, base_url, model}.

  Edit mode: no Provider combobox. Reverse-mapping base_url → provider is
  brittle (user might've edited it). Wire Format select in Advanced does
  what "change provider" would, for the actual stored field.
-->
<script lang="ts">
  import Field from '../ui/Field.svelte';
  import Input from '../ui/Input.svelte';
  import Select from '../ui/Select.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import Button from '../ui/Button.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import InlineDrawer from '../ui/InlineDrawer.svelte';
  import Combobox, { type ComboOption } from '../ui/Combobox.svelte';
  import type { Connection, ConnectionKind, CatalogModel } from '$lib/api/types';
  import { connections } from '$lib/state/connections.svelte';
  import { catalog } from '$lib/state/catalog.svelte';
  import { toasts } from '$lib/state/toast.svelte';
  import { val } from '$lib/utils/dom';

  interface Props {
    /** undefined = create mode; defined = edit mode */
    editing?: Connection;
    oncancel: () => void;
    onsaved: (conn: Connection) => void;
  }

  let { editing, oncancel, onsaved }: Props = $props();

  const CUSTOM = '__custom__';

  function parseJSON<T>(s: string | undefined, fallback: T): T {
    if (!s) return fallback;
    try { return JSON.parse(s) as T; } catch { return fallback; }
  }

  // ── Draft state ──────────────────────────────────────────────────────────
  // Snapshot at construction time. The parent {#key}s edit-mode instances on
  // conn.id, so `editing` never changes during this component's lifetime —
  // capturing it once is correct.
  /* svelte-ignore state_referenced_locally */
  let draft = $state({
    label: editing?.label ?? '',
    kind: (editing?.kind ?? 'openai') as ConnectionKind,
    base_url: editing?.base_url ?? '',
    api_key: editing?.api_key ?? '',
    model: editing?.model ?? '',
    extra_headers: parseJSON<Record<string, string>>(editing?.extra_headers, {}),
    extra_body: parseJSON<Record<string, unknown>>(editing?.extra_body, {}),
  });

  /** Create mode only. Drives form pre-fill, never persisted. */
  let providerId = $state<string | null>(null);
  /** Did the user touch base_url after picking a provider? Routes save to raw create. */
  let baseUrlDirty = $state(false);
  /** Did the user type their own label? If not, picking a model rewrites it. */
  /* svelte-ignore state_referenced_locally */
  let labelDirty = $state(editing != null);

  let testResult = $state<{ ok: boolean; models?: string[]; error?: string } | null>(null);
  let testing = $state(false);

  let extraBodyText = $state(JSON.stringify(draft.extra_body, null, 2));
  let extraBodyError = $state(false);

  let providerCombo: Combobox | undefined = $state();

  // Focus the Provider combobox on open in create mode.
  $effect(() => {
    if (!editing) providerCombo?.focus();
  });

  // ── Provider combobox source ─────────────────────────────────────────────
  // Real providers + one synthetic "Custom" escape hatch at the end.
  const providerOptions = $derived<ComboOption[]>([
    ...catalog.providers.map((p) => ({ value: p.id, label: p.name })),
    { value: CUSTOM, label: 'Custom (OAI-compatible)' },
  ]);

  /** Display string in the provider input — bound separately so typing
   *  filters without committing. */
  let providerInput = $state('');

  function pickProvider(opt: ComboOption) {
    providerId = opt.value;
    baseUrlDirty = false;
    testResult = null;

    if (opt.value === CUSTOM) {
      draft.kind = 'openai';
      draft.base_url = '';
      draft.model = '';
      if (!labelDirty) draft.label = '';
      providerInput = opt.label;
      return;
    }

    const p = catalog.byId(opt.value);
    if (!p) return;
    draft.kind = p.kind;
    draft.base_url = p.base_url;
    if (!labelDirty) draft.label = p.name;
    // Newest first — catalog sorts by release desc. We don't have a "good
    // default for RP" opinion (Opus for one user, DeepSeek for another).
    draft.model = p.models[0]?.id ?? '';
    providerInput = p.name;
  }

  // ── Model combobox source ────────────────────────────────────────────────
  // Priority: live test result > catalog > cached test result for this conn.
  // Fall through to free text (options=[]) for custom/local.
  function modelToOption(m: CatalogModel): ComboOption {
    const ctx = m.ctx >= 1_000_000 ? `${m.ctx / 1_000_000}M` : `${Math.round(m.ctx / 1000)}K`;
    const cost = m.cost ? `$${m.cost[0]}/$${m.cost[1]}` : null;
    return {
      value: m.id,
      label: m.name,
      meta: [ctx, cost].filter(Boolean).join(' · '),
      badge: [m.vision && '👁', m.reasoning && '🧠'].filter(Boolean).join(''),
    };
  }

  const modelOptions = $derived.by((): ComboOption[] => {
    // Live test result wins (fresh from upstream).
    if (testResult?.ok && testResult.models) {
      return testResult.models.map((id) => ({ value: id, label: id }));
    }
    // Create mode: catalog models for the picked provider.
    if (!editing && providerId && providerId !== CUSTOM) {
      const p = catalog.byId(providerId);
      if (p) return p.models.map(modelToOption);
    }
    // Edit mode: cached test result from a previous Test.
    if (editing) {
      const cached = connections.modelsFor(editing.id);
      if (cached.length > 0) return cached.map((id) => ({ value: id, label: id }));
    }
    return [];
  });

  // Picking a model rewrites the label (if still default). Cosmetic.
  // "Anthropic" + pick claude-opus-4-5 → "Anthropic — Opus 4.5"
  function pickModel(opt: ComboOption) {
    if (labelDirty || editing) return;
    const p = providerId && providerId !== CUSTOM ? catalog.byId(providerId) : null;
    if (p && opt.label !== opt.value) {
      draft.label = `${p.name} — ${opt.label}`;
    }
  }

  // ── API key header hint ──────────────────────────────────────────────────
  const keyHint = $derived.by(() => {
    if (!editing && providerId && providerId !== CUSTOM) {
      return catalog.byId(providerId)?.key_header;
    }
    if (draft.kind === 'anthropic') return 'x-api-key';
    if (draft.kind === 'google') return 'x-goog-api-key';
    return undefined;  // 'Authorization: Bearer' is the default, no hint needed
  });

  // ── Extra headers editor ─────────────────────────────────────────────────
  // Stable wrapper objects so bind:value works on $each rows. Synced back
  // to draft.extra_headers on save.
  let headerRows = $state(
    Object.entries(draft.extra_headers).map(([k, v]) => ({ k, v })),
  );

  function addHeaderRow() { headerRows.push({ k: '', v: '' }); }
  function dropHeaderRow(i: number) { headerRows.splice(i, 1); }

  // ── Extra body validation ────────────────────────────────────────────────
  function validateExtraBody() {
    const trimmed = extraBodyText.trim();
    if (!trimmed || trimmed === '{}') {
      draft.extra_body = {};
      extraBodyError = false;
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        extraBodyError = true;
        return;
      }
      draft.extra_body = parsed;
      extraBodyError = false;
    } catch {
      extraBodyError = true;
    }
  }

  // ── Test ─────────────────────────────────────────────────────────────────
  // Backend currently only supports /:id/test. For create mode, save first.
  // For edit mode with dirty fields, the test runs against the *saved* row,
  // which is wrong but matches current backend capability. The spec flagged
  // a body-accepting test variant; until that lands, edit-mode users save
  // then test.
  async function test() {
    if (!editing) {
      toasts.info('Save first, then Test');
      return;
    }
    testing = true;
    try {
      await connections.test(editing.id);
      // test() already cached models internally; mirror locally for the combobox.
      const cached = connections.modelsFor(editing.id);
      testResult = { ok: cached.length > 0, models: cached };
    } finally {
      testing = false;
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const canSave = $derived(
    draft.label.trim() !== '' &&
    draft.base_url.trim() !== '' &&
    draft.model.trim() !== '' &&
    !extraBodyError,
  );

  async function save() {
    if (!canSave) return;

    // Sync header rows back into the record.
    draft.extra_headers = Object.fromEntries(
      headerRows.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v]),
    );

    try {
      let conn: Connection;
      if (editing) {
        await connections.patch(editing.id, {
          label: draft.label,
          kind: draft.kind,
          base_url: draft.base_url,
          api_key: draft.api_key,
          model: draft.model,
          extra_headers: draft.extra_headers,
          extra_body: draft.extra_body,
        });
        conn = connections.byId(editing.id)!;
      } else if (providerId && providerId !== CUSTOM && !baseUrlDirty) {
        // Picked a Provider, didn't touch Base URL → let server own kind+base_url.
        conn = await connections.fromCatalog(providerId, {
          label: draft.label,
          api_key: draft.api_key || undefined,
          model: draft.model,
        });
      } else {
        // Custom, or touched Base URL → raw create.
        conn = await connections.create({
          label: draft.label,
          kind: draft.kind,
          base_url: draft.base_url,
          api_key: draft.api_key || undefined,
          model: draft.model,
          extra_headers: Object.keys(draft.extra_headers).length > 0 ? draft.extra_headers : undefined,
          extra_body: Object.keys(draft.extra_body).length > 0 ? draft.extra_body : undefined,
        });
      }
      onsaved(conn);
    } catch (err) {
      toasts.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      oncancel();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="panel-chrome p-3 flex flex-col gap-2" onkeydown={onkeydown}>
  <div class="flex items-center justify-between">
    <span class="text-sm font-bold opacity-80">
      {editing ? `Editing: ${editing.label}` : 'New connection'}
    </span>
    <button
      class="right-menu-btn i-fa6-solid:xmark w-3 h-3"
      onclick={oncancel}
      aria-label="Cancel"
    ></button>
  </div>

  {#if !editing}
    <Field label="Provider">
      <Combobox
        bind:this={providerCombo}
        bind:value={providerInput}
        options={providerOptions}
        placeholder="Pick a provider or type to search…"
        onpick={pickProvider}
      />
    </Field>
  {/if}

  <Field label="Label">
    <Input
      bind:value={draft.label}
      placeholder="My API"
      oninput={() => labelDirty = true}
    />
  </Field>

  <Field label="Base URL">
    <Input
      bind:value={draft.base_url}
      type="url"
      placeholder="https://api.openai.com/v1"
      oninput={() => baseUrlDirty = true}
    />
  </Field>

  <Field label="API Key" hint={keyHint}>
    <Input bind:value={draft.api_key} type="password" autocomplete="off" />
  </Field>

  <Field label="Model">
    <Combobox
      bind:value={draft.model}
      options={modelOptions}
      placeholder="Type a model id…"
      onpick={pickModel}
    />
  </Field>

  <InlineDrawer title="Advanced">
    <Field label="Wire format" hint="request shaper">
      <Select
        value={draft.kind}
        options={[
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic' },
          { value: 'google', label: 'Google' },
        ]}
        onchange={(v) => draft.kind = v as ConnectionKind}
      />
    </Field>

    <Field label="Extra headers">
      <div class="flex flex-col gap-1">
        {#each headerRows as row, i (i)}
          <div class="flex gap-1 items-center">
            <Input bind:value={row.k} placeholder="Header-Name" class="flex-1" />
            <Input bind:value={row.v} placeholder="value" class="flex-1" />
            <IconButton icon="xmark" size="sm" title="Remove" onclick={() => dropHeaderRow(i)} />
          </div>
        {/each}
        <Button variant="ghost" class="self-start text-xs" onclick={addHeaderRow}>
          <span class="i-fa6-solid:plus mr-1"></span> Add header
        </Button>
      </div>
    </Field>

    <Field label="Extra body" hint="JSON, merged into the request">
      <Textarea
        bind:value={extraBodyText}
        rows={3}
        maxHeight={150}
        spellcheck="false"
        class={extraBodyError ? '!border-crimson' : ''}
        onblur={validateExtraBody}
        oninput={(e) => extraBodyText = val(e)}
      />
      {#if extraBodyError}
        <span class="text-xs text-red-400">Invalid JSON object</span>
      {/if}
    </Field>
  </InlineDrawer>

  <div class="flex items-center gap-2 mt-1">
    <Button variant="primary" onclick={save} disabled={!canSave}>
      Save
    </Button>
    <Button onclick={test} disabled={testing || !editing}>
      <span class="i-fa6-solid:vial mr-1"></span>
      {testing ? 'Testing…' : 'Test'}
    </Button>
    <span class="flex-1"></span>
    <Button variant="ghost" onclick={oncancel}>Cancel</Button>
  </div>
</div>
