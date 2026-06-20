// ─────────────────────────────────────────────────────────────────────────────
// Typed DOM helpers. The `e.currentTarget as HTMLInputElement` cast is noise
// repeated 50 times; centralizing it means one place to get the types right.
//
// Why currentTarget, not target: target is the deepest element clicked
// (could be a child <span>); currentTarget is the element the listener is
// bound to (the input). For value-reading we always want the latter.
// ─────────────────────────────────────────────────────────────────────────────

/** Read .value from an input/textarea/select event. */
export function val(e: Event): string {
  const t = e.currentTarget;
  if (!t) return '';
  if (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement
  ) {
    return t.value;
  }
  return '';
}

/** Read .checked from a checkbox/radio event. */
export function checked(e: Event): boolean {
  return e.currentTarget instanceof HTMLInputElement && e.currentTarget.checked;
}

/** Read .files from a file input event. Returns empty array if not a file input. */
export function files(e: Event): File[] {
  const t = e.currentTarget;
  if (t instanceof HTMLInputElement && t.files) return [...t.files];
  return [];
}

/** Reset a file input so picking the same file twice fires onchange. */
export function resetInput(e: Event): void {
  if (e.currentTarget instanceof HTMLInputElement) e.currentTarget.value = '';
}
