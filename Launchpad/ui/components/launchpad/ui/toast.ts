export type ToastVariant = 'default' | 'success' | 'error';

export interface ToastPayload {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

/**
 * Lightweight toast emitter (no external deps).
 * Works with <Toaster /> which listens for the 'maha-toast' event in the browser.
 */
export function toast(payload: ToastPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('maha-toast', { detail: payload }));
}


