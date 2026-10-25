'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  href?: string;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
  className?: string;
  widthClassName?: string;
}

export function Dropdown({
  trigger,
  items,
  align = 'end',
  className,
  widthClassName = 'w-48',
}: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      <div
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex cursor-pointer"
      >
        {trigger}
      </div>
      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-40 mt-1.5 origin-top animate-slide-down overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-float',
            widthClassName,
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, index) => {
            const content = (
              <>
                {item.icon ? <span className="text-muted-foreground">{item.icon}</span> : null}
                <span className="truncate">{item.label}</span>
              </>
            );
            const classes = cn(
              'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
              item.danger
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-foreground hover:bg-muted',
              item.disabled && 'pointer-events-none opacity-50',
            );
            return (
              <React.Fragment key={`${item.label}-${index}`}>
                {item.separatorBefore ? <div className="my-1 h-px bg-border" /> : null}
                {item.href ? (
                  <a href={item.href} role="menuitem" className={classes} onClick={() => setOpen(false)}>
                    {content}
                  </a>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={classes}
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false);
                      item.onSelect?.();
                    }}
                  >
                    {content}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
