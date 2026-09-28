'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from "@/lib/utils";
import type { ToastPayload, ToastVariant } from './toast';

type ToastItem = ToastPayload & { id: string; createdAt: number };

const variantClasses: Record<ToastVariant, string> = {
  default: 'border-slate-200 bg-white text-slate-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const ce = event as CustomEvent<ToastPayload>;
      const payload = ce.detail;
      if (!payload?.title) return;

      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const item: ToastItem = {
        id,
        createdAt: Date.now(),
        title: payload.title,
        description: payload.description,
        variant: payload.variant || 'default',
        durationMs: payload.durationMs ?? 5000,
      };

      setToasts((prev) => [item, ...prev].slice(0, 3));

      const ttl = Math.max(1500, item.durationMs || 5000);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ttl);
    };

    window.addEventListener('maha-toast', onToast);
    return () => window.removeEventListener('maha-toast', onToast);
  }, []);

  const list = useMemo(() => toasts, [toasts]);

  if (list.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            'rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm',
            variantClasses[t.variant || 'default']
          )}
        >
          <div className="text-sm font-semibold">{t.title}</div>
          {t.description ? <div className="mt-1 text-sm opacity-90">{t.description}</div> : null}
        </div>
      ))}
    </div>
  );
}


