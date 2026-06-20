// ─────────────────────────────────────────────────────────────────────────────
// UI state. The drawer model: 9 named drawers, side ones can stack with the
// center one but not each other. Floats are independent. No router — this is
// a single-page app with overlay panels.
// ─────────────────────────────────────────────────────────────────────────────

export type DrawerId =
  | 'connection'   // center — the catalog form wants width
  | 'preset'       // fillLeft
  | 'lorebook'     // center
  | 'theme'        // center
  | 'background'   // center
  | 'extension'    // center
  | 'persona'      // fillRight
  | 'character'    // fillRight
  | 'settings';    // fillRight

const SIDE: Record<DrawerId, 'left' | 'center' | 'right'> = {
  connection: 'center',
  preset: 'left',
  lorebook: 'center',
  theme: 'center',
  background: 'center',
  extension: 'center',
  persona: 'right',
  character: 'right',
  settings: 'right',
};

/** One left + one center + one right can be open simultaneously. */
let openDrawers = $state<Set<DrawerId>>(new Set());

/** Floating panels (token counter, prompt itemizer). Independent of drawers. */
let openFloats = $state<Set<string>>(new Set());

/** Background image filename (under /blobs/backgrounds/). */
export const background = $state({ filename: '' });

/** Mobile breakpoint cache. Updated by an $effect in App. */
export const viewport = $state({ isMobile: false });

export const ui = {
  isOpen: (id: DrawerId) => openDrawers.has(id),

  /**
   * Toggle a drawer. Opening evicts the current occupant of the same side
   * (left/center/right). Center additionally evicts both sides on mobile.
   */
  toggle(id: DrawerId): void {
    if (openDrawers.has(id)) {
      openDrawers.delete(id);
    } else {
      // Evict same-side occupant.
      const side = SIDE[id];
      for (const open of openDrawers) {
        if (SIDE[open] === side) openDrawers.delete(open);
      }
      // Mobile: any drawer evicts all others.
      if (viewport.isMobile) openDrawers.clear();
      openDrawers.add(id);
    }
    // Reassign for reactivity. Set mutations don't trigger $state.
    openDrawers = new Set(openDrawers);
  },

  open(id: DrawerId): void {
    if (!openDrawers.has(id)) ui.toggle(id);
  },

  close(id: DrawerId): void {
    if (openDrawers.has(id)) {
      openDrawers.delete(id);
      openDrawers = new Set(openDrawers);
    }
  },

  closeAll(): void {
    openDrawers = new Set();
  },

  /** Esc closes the topmost drawer (center > right > left precedence). */
  closeTop(): boolean {
    const order: ('center' | 'right' | 'left')[] = ['center', 'right', 'left'];
    for (const side of order) {
      for (const id of openDrawers) {
        if (SIDE[id] === side) {
          ui.close(id);
          return true;
        }
      }
    }
    return false;
  },

  // ── Floats ────────────────────────────────────────────────────────────────
  isFloatOpen: (id: string) => openFloats.has(id),
  toggleFloat(id: string): void {
    if (openFloats.has(id)) openFloats.delete(id);
    else openFloats.add(id);
    openFloats = new Set(openFloats);
  },

  // ── Reactive iterator (for #each in TopBar pulse) ─────────────────────────
  get openDrawers() { return [...openDrawers]; },
};
