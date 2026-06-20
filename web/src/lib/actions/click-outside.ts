// use:clickOutside — fire when a click lands outside the node.
// capture: true so we see the click before whatever else handles it (e.g.
// the button that *opens* the thing we're closing). The handler can swap on
// update; the listener stays bound once.
//
// The event is passed through so callers can guard on e.target (e.g. an
// opener button living outside the popup — click-outside shouldn't fire
// for it since the same click toggles the opener). Callers that don't
// care can ignore the arg.

export function clickOutside(node: HTMLElement, handler: (e: MouseEvent) => void) {
  function onClick(e: MouseEvent) {
    if (!node.contains(e.target as Node)) handler(e);
  }
  document.addEventListener('click', onClick, true);
  return {
    destroy() { document.removeEventListener('click', onClick, true); },
    update(h: (e: MouseEvent) => void) { handler = h; },
  };
}
