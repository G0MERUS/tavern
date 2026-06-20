/** Trigger a download of a Blob/string. */
export function download(content: Blob | string, filename: string, type = 'application/json'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke on next tick — Safari needs the click to land first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Read a File as text. */
export function readFileText(file: File): Promise<string> {
  return file.text();
}

/** Sniff JSON shape to route a dropped .json to the right importer. */
export function sniffJsonShape(
  json: unknown,
): 'character' | 'lorebook' | 'preset' | 'unknown' {
  if (!json || typeof json !== 'object') return 'unknown';
  const o = json as Record<string, unknown>;
  if (o['spec'] === 'chara_card_v2' || o['spec'] === 'chara_card_v3') return 'character';
  // V2 cards nest under .data; check for the load-bearing field.
  const data = o['data'];
  if (data && typeof data === 'object' && 'first_mes' in data) return 'character';
  if (o['entries'] !== undefined || Array.isArray(o['entries'])) return 'lorebook';
  // ST preset: prompts[] AND (prompt_order OR temp_openai OR openai_max_context).
  // TavernA preset: namespaced under `samplers`.
  if (Array.isArray(o['prompts']) && ('prompt_order' in o || 'temp_openai' in o || 'openai_max_context' in o)) return 'preset';
  if (o['samplers'] !== undefined && o['prompts'] !== undefined) return 'preset';
  if (o['temperature'] !== undefined) return 'preset';
  return 'unknown';
}
