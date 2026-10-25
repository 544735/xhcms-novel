'use client';

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastStore {
  items: ToastItem[];
  push: (item: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  items: [],
  push(item) {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const next: ToastItem = { id, duration: 4200, ...item };
    set({ items: [...get().items, next].slice(-5) });
    if (next.duration > 0) {
      setTimeout(() => {
        if (get().items.some((toast) => toast.id === id)) {
          useToastStore.setState({ items: get().items.filter((toast) => toast.id !== id) });
        }
      }, next.duration);
    }
    return id;
  },
  dismiss(id) {
    set({ items: get().items.filter((item) => item.id !== id) });
  },
}));

type ToastOptions = { description?: string; duration?: number };

type ToastApi = ((title: string, options?: ToastOptions) => string) & {
  success: (title: string, options?: ToastOptions) => string;
  error: (title: string, options?: ToastOptions) => string;
  info: (title: string, options?: ToastOptions) => string;
  warning: (title: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const base = (variant: ToastVariant) => (title: string, options?: ToastOptions) =>
  useToastStore.getState().push({ title, variant, description: options?.description, duration: options?.duration });

export const toast: ToastApi = Object.assign(base('info'), {
  success: base('success'),
  error: base('error'),
  info: base('info'),
  warning: base('warning'),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
});

const variantStyles: Record<ToastVariant, { icon: React.ReactNode; accent: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-success" />,
    accent: 'border-l-success',
  },
  error: {
    icon: <XCircle className="h-5 w-5 text-destructive" />,
    accent: 'border-l-destructive',
  },
  warning: {
    icon: <TriangleAlert className="h-5 w-5 text-warning" />,
    accent: 'border-l-warning',
  },
  info: {
    icon: <Info className="h-5 w-5 text-primary" />,
    accent: 'border-l-primary',
  },
};

export function Toaster() {
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
      {items.map((item) => {
        const style = variantStyles[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              'pointer-events-auto flex animate-slide-up items-start gap-3 rounded-xl border border-l-4 border-border/80 bg-card/95 p-3.5 shadow-float backdrop-blur',
              style.accent,
            )}
          >
            <div className="mt-0.5 shrink-0">{style.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="关闭提示"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
