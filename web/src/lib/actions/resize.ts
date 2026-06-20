// ─────────────────────────────────────────────────────────────────────────────
// use:resize — drag-to-resize for drawers, popups, textareas.
//
// Two modes:
//   axis='x'         → injected edge grip strip (drawers). pointercapture drag.
//   axis='y'|'both'  → native CSS resize corner. ResizeObserver detects
//                      user drags and locks auto-grow out.
//
// The action stashes a controller on `node.__resize`. Components that need
// to coordinate auto-grow (Textarea, SendForm) read `el.__resize.setSize(n)`.
// Svelte 5 has no bind:action= syntax; the node-attached field is the
// contained-ugly that makes the lockout work without a store-per-textarea.
//
// Persistence: settings.panelSizes[key]. Single-axis stores a number;
// 'both' stores [w, h]. Double-click clears the key and unlocks auto-grow.
// ─────────────────────────────────────────────────────────────────────────────

import { settings, persist } from '../state/settings.svelte';

export interface ResizeOptions {
  /**
   * 'x'      — vertical edge grip (drawers). pointercapture drag.
   * 'y'      — native bottom-right corner. ResizeObserver watches.
   * 'y-grip' — horizontal top grip (chat input). No observer; auto-grow
   *            and drag can't race because there's nothing watching.
   * 'both'   — native corner, both dimensions (popups).
   */
  axis: 'x' | 'y' | 'y-grip' | 'both';
  /** settings.panelSizes[key]. Omit for ephemeral resize. */
  key?: string;
  min?: number;
  max?: number;
  /** axis='x' only: which side the grip strip sits on. */
  edge?: 'left' | 'right';
  /** Live callback during drag. Drawer uses this to set inline width. */
  onresize?: (size: number) => void;
}

export interface ResizeController {
  /**
   * Auto-grow: reset to 'auto', measure scrollHeight, set height. Done under
   * observer-suppression so the reset doesn't get mistaken for a user drag.
   * No-op once locked. The whole dance lives here so callers can't fumble it.
   */
  autosize: (max?: number) => void;
  /** True after user drags the corner. */
  readonly locked: boolean;
}

declare global {
  interface HTMLElement { __resize?: ResizeController }
}

export function resize(node: HTMLElement, opts: ResizeOptions) {
  if (opts.axis === 'x') return gripResizeX(node, opts);
  if (opts.axis === 'y-grip') return gripResizeY(node, opts);
  return cornerResize(node, opts);
}

// ── Mode 1: vertical edge grip (drawers) ─────────────────────────────────────

function gripResizeX(node: HTMLElement, opts: ResizeOptions) {
  const edge = opts.edge ?? 'right';
  const sign = edge === 'left' ? -1 : 1; // dragging left widens a right-anchored drawer

  const grip = document.createElement('div');
  grip.className = 'resize-grip-x';
  grip.style[edge] = '-3px'; // half the 6px width hangs outside
  // The grip needs a positioned ancestor. `fixed`/`absolute`/`relative` all
  // establish containing blocks for absolute children — only `static` doesn't.
  // Check computed style, not the inline attr: drawers get `position: fixed`
  // from a class, and `node.style.position ||= 'relative'` would nuke it.
  if (getComputedStyle(node).position === 'static') {
    node.style.position = 'relative';
  }
  node.appendChild(grip);

  let startX = 0;
  let startW = 0;

  function clamp(w: number): number {
    const min = opts.min ?? 280;
    const max = opts.max ?? window.innerWidth * 0.9;
    return Math.max(min, Math.min(max, w));
  }

  function onMove(e: PointerEvent) {
    const w = clamp(startW + (e.clientX - startX) * sign);
    opts.onresize?.(w);
  }

  function onUp(e: PointerEvent) {
    grip.classList.remove('dragging');
    grip.releasePointerCapture(e.pointerId);
    grip.removeEventListener('pointermove', onMove);
    grip.removeEventListener('pointerup', onUp);
    if (opts.key) {
      settings.panelSizes[opts.key] = clamp(node.offsetWidth);
      persist('panelSizes');
    }
  }

  function onDown(e: PointerEvent) {
    e.preventDefault();
    startX = e.clientX;
    startW = node.offsetWidth;
    grip.classList.add('dragging');
    grip.setPointerCapture(e.pointerId);
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
  }

  function onDblClick() {
    if (opts.key) {
      delete settings.panelSizes[opts.key];
      persist('panelSizes');
    }
    opts.onresize?.(0); // 0 = "use default" sentinel; caller falls back to clamp()
  }

  grip.addEventListener('pointerdown', onDown);
  grip.addEventListener('dblclick', onDblClick);

  return {
    destroy() {
      grip.removeEventListener('pointerdown', onDown);
      grip.removeEventListener('dblclick', onDblClick);
      grip.remove();
    },
  };
}

// ── Mode 2: horizontal top grip (chat input) ─────────────────────────────────
// No ResizeObserver. Auto-grow writes height directly; the only path to
// `userLocked = true` is an actual pointer drag on the grip. Both can fire on
// the same frame and the worst case is one wins. There is no race.

function gripResizeY(node: HTMLElement, opts: ResizeOptions) {
  const grip = document.createElement('div');
  grip.className = 'resize-grip-y';
  // The grip is absolutely positioned inside the textarea's *parent*. Anchoring
  // it to the textarea itself would clip it (textarea is overflow:auto) and
  // make it scroll with the content.
  const parent = node.parentElement!;
  if (getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }
  parent.appendChild(grip);

  let startY = 0;
  let startH = 0;
  let userLocked = false;

  // Restore persisted height. Lock so auto-grow doesn't fight.
  if (opts.key) {
    const stored = settings.panelSizes[opts.key];
    if (typeof stored === 'number') {
      node.style.height = `${stored}px`;
      userLocked = true;
    }
  }

  function clamp(h: number): number {
    const min = opts.min ?? 36;
    const max = opts.max ?? window.innerHeight * 0.5;
    return Math.max(min, Math.min(max, h));
  }

  function onMove(e: PointerEvent) {
    // Dragging up = taller. The grip is on top.
    node.style.height = `${clamp(startH - (e.clientY - startY))}px`;
  }

  function onUp(e: PointerEvent) {
    grip.classList.remove('dragging');
    grip.releasePointerCapture(e.pointerId);
    grip.removeEventListener('pointermove', onMove);
    grip.removeEventListener('pointerup', onUp);
    if (opts.key) {
      settings.panelSizes[opts.key] = node.offsetHeight;
      persist('panelSizes');
    }
  }

  function onDown(e: PointerEvent) {
    e.preventDefault();
    startY = e.clientY;
    startH = node.offsetHeight;
    userLocked = true;
    grip.classList.add('dragging');
    grip.setPointerCapture(e.pointerId);
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
  }

  function onDblClick() {
    userLocked = false;
    if (opts.key) {
      delete settings.panelSizes[opts.key];
      persist('panelSizes');
    }
    node.style.height = '';
    controller.autosize();
  }

  grip.addEventListener('pointerdown', onDown);
  grip.addEventListener('dblclick', onDblClick);

  const controller: ResizeController = {
    autosize(max = 0) {
      if (userLocked) return;
      node.style.height = 'auto';
      const target = node.scrollHeight + 2;
      const want = max > 0 ? Math.min(target, max) : target;
      node.style.height = `${clamp(want)}px`;
    },
    get locked() { return userLocked; },
  };
  node.__resize = controller;

  return {
    destroy() {
      grip.removeEventListener('pointerdown', onDown);
      grip.removeEventListener('dblclick', onDblClick);
      grip.remove();
      delete node.__resize;
    },
  };
}

// ── Mode 3: native corner (textareas, popups) ────────────────────────────────

function cornerResize(node: HTMLElement, opts: ResizeOptions) {
  node.style.resize = opts.axis === 'both' ? 'both' : 'vertical';
  node.style.overflow ||= 'auto';

  // Restore persisted size on mount.
  if (opts.key) {
    const stored = settings.panelSizes[opts.key];
    if (typeof stored === 'number') {
      node.style.height = `${stored}px`;
    } else if (Array.isArray(stored)) {
      node.style.width = `${stored[0]}px`;
      node.style.height = `${stored[1]}px`;
    }
  }

  // Counter, not boolean: autosize() does TWO height writes ('auto' → px),
  // and ResizeObserver may coalesce or split those into 1–2 callbacks
  // depending on layout timing. A boolean clears too soon.
  let suppress = 0;
  let userLocked = opts.key ? settings.panelSizes[opts.key] !== undefined : false;
  // -1 = no baseline yet. The first observer tick establishes it; we never
  // lock on first observation. Can't precompute: offsetHeight is border-box,
  // contentRect is content-box, and the diff depends on computed padding.
  let lastH = -1;
  let lastW = -1;

  const ro = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const h = Math.round(entry.contentRect.height);
    const w = Math.round(entry.contentRect.width);

    if (lastH < 0) { lastH = h; lastW = w; return; }   // baseline
    if (suppress > 0) { suppress--; lastH = h; lastW = w; return; }
    if (h === lastH && w === lastW) return;
    lastH = h; lastW = w;

    // User dragged the native corner. Lock auto-grow out.
    userLocked = true;
    opts.onresize?.(h);
    if (opts.key) {
      settings.panelSizes[opts.key] = opts.axis === 'both' ? [w, h] : h;
      persist('panelSizes');
    }
  });
  ro.observe(node);

  function onDblClick(e: MouseEvent) {
    // Only clear if click is in the resize-handle corner zone (~20px from
    // bottom-right). dblclick on body text shouldn't reset.
    const rect = node.getBoundingClientRect();
    if (rect.right - e.clientX > 20 || rect.bottom - e.clientY > 20) return;
    userLocked = false;
    if (opts.key) {
      delete settings.panelSizes[opts.key];
      persist('panelSizes');
    }
    suppress++;
    node.style.height = '';
    if (opts.axis === 'both') node.style.width = '';
  }
  node.addEventListener('dblclick', onDblClick);

  const controller: ResizeController = {
    autosize(max = 0) {
      if (userLocked) return; // user wins
      // Two height writes → up to two observer ticks to swallow.
      suppress += 2;
      node.style.height = 'auto';
      const target = node.scrollHeight + 2; // border fudge
      const want = max > 0 ? Math.min(target, max) : target;
      const min = opts.min ?? 0;
      const cap = opts.max ?? window.innerHeight * 0.8;
      node.style.height = `${Math.max(min, Math.min(want, cap))}px`;
    },
    get locked() { return userLocked; },
  };
  node.__resize = controller;

  return {
    destroy() {
      ro.disconnect();
      node.removeEventListener('dblclick', onDblClick);
      delete node.__resize;
    },
  };
}
