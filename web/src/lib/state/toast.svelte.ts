// Tiny toast queue. The original uses toastr.js (jQuery). We don't.

export interface Toast {
  id: number;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timeout: number;
}

let nextId = 0;
let items = $state<Toast[]>([]);

export const toasts = {
  get items() { return items; },

  push(type: Toast['type'], message: string, timeout = 4000): number {
    const id = nextId++;
    items = [...items, { id, type, message, timeout }];
    if (timeout > 0) {
      setTimeout(() => toasts.dismiss(id), timeout);
    }
    return id;
  },

  dismiss(id: number): void {
    items = items.filter((t) => t.id !== id);
  },

  info: (m: string, t?: number) => toasts.push('info', m, t),
  success: (m: string, t?: number) => toasts.push('success', m, t),
  warning: (m: string, t?: number) => toasts.push('warning', m, t),
  error: (m: string, t = 8000) => toasts.push('error', m, t),
};
