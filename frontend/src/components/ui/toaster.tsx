'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';

type ToastVariant = 'default' | 'success' | 'error';

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  remove: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

function showToast(args: { title: string; description?: string; variant?: ToastVariant }) {
  useToastStore.getState().push({ variant: 'default', ...args });
}

export const toast = Object.assign(showToast, {
  success: (title: string, description?: string) =>
    showToast({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    showToast({ title, description, variant: 'error' }),
});

export function Toaster() {
  const { toasts, remove } = useToastStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className={
            'pointer-events-auto w-full max-w-sm cursor-pointer rounded-lg border bg-white p-4 shadow-lg ' +
            (t.variant === 'error'
              ? 'border-red-300 bg-red-50'
              : t.variant === 'success'
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200')
          }
        >
          <div className="text-sm font-semibold text-gray-900">{t.title}</div>
          {t.description ? (
            <div className="mt-1 text-xs text-gray-600">{t.description}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
