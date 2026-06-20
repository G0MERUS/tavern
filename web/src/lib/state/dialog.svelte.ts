// ─────────────────────────────────────────────────────────────────────────────
// Promise-based dialogs. The original uses callPopup() which spawns jQuery
// HTML and resolves on click. Same API: `await confirm("Delete?")` → boolean.
// ─────────────────────────────────────────────────────────────────────────────

interface DialogState {
  open: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm' | 'prompt';
  defaultValue: string;
  resolve: ((value: unknown) => void) | null;
}

const state = $state<DialogState>({
  open: false,
  title: '',
  message: '',
  type: 'alert',
  defaultValue: '',
  resolve: null,
});

export const dialog = {
  get state() { return state; },

  alert(message: string, title = ''): Promise<void> {
    return new Promise((resolve) => {
      state.title = title;
      state.message = message;
      state.type = 'alert';
      state.open = true;
      state.resolve = () => resolve();
    });
  },

  confirm(message: string, title = 'Confirm'): Promise<boolean> {
    return new Promise((resolve) => {
      state.title = title;
      state.message = message;
      state.type = 'confirm';
      state.open = true;
      state.resolve = (v) => resolve(v === true);
    });
  },

  prompt(message: string, defaultValue = '', title = ''): Promise<string | null> {
    return new Promise((resolve) => {
      state.title = title;
      state.message = message;
      state.type = 'prompt';
      state.defaultValue = defaultValue;
      state.open = true;
      state.resolve = (v) => resolve(typeof v === 'string' ? v : null);
    });
  },

  /** Called by Dialog.svelte on button click. */
  resolve(value: unknown): void {
    state.open = false;
    state.resolve?.(value);
    state.resolve = null;
  },
};
