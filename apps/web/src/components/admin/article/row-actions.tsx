'use client';

import { MoreHorizontal } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface RowActionItem {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface RowActionsProps {
  items: RowActionItem[];
  label?: string;
  disabled?: boolean;
}

const MENU_WIDTH = 192;
const ITEM_HEIGHT = 36;

/**
 * 表格行操作菜单。
 * 通过 Portal + fixed 定位渲染到 body，避免被 .data-table 的 overflow-x-auto 或
 * Card 的 overflow-hidden 裁剪（最后一行的下拉项因此仍可点击）。
 */
export function RowActions({ items, label = '操作', disabled }: RowActionsProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const updatePosition = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedHeight = items.length * ITEM_HEIGHT + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight + 12 && rect.top > estimatedHeight + 12;
    const top = openUp
      ? Math.max(8, rect.top - estimatedHeight - 6)
      : Math.min(window.innerHeight - estimatedHeight - 8, rect.bottom + 6);
    const left = Math.max(
      8,
      Math.min(window.innerWidth - MENU_WIDTH - 8, rect.right - MENU_WIDTH),
    );
    setPosition({ top, left });
  }, [items.length]);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const handleReposition = () => setOpen(false);

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open, updatePosition]);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
              className="fixed z-[70] animate-slide-down overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-float"
            >
              {items.map((item, index) => (
                <React.Fragment key={`${item.label}-${index}`}>
                  {item.separatorBefore ? <div className="my-1 h-px bg-border" /> : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false);
                      item.onSelect?.();
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      item.danger
                        ? 'text-destructive hover:bg-destructive/10'
                        : 'text-foreground hover:bg-muted',
                      item.disabled && 'pointer-events-none opacity-50',
                    )}
                  >
                    {item.icon ? (
                      <span className="shrink-0 text-muted-foreground">{item.icon}</span>
                    ) : null}
                    <span className="truncate">{item.label}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
