import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info' | 'purple';

const variants: Record<Variant, string> = {
  default: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20',
  secondary: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
  outline: 'text-muted-foreground ring-1 ring-inset ring-border',
  success: 'bg-success/10 text-success ring-1 ring-inset ring-success/20 dark:text-emerald-400',
  warning: 'bg-warning/10 text-warning ring-1 ring-inset ring-warning/25 dark:text-amber-400',
  destructive: 'bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20',
  info: 'bg-sky-500/10 text-sky-600 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400',
  purple: 'bg-violet-500/10 text-violet-600 ring-1 ring-inset ring-violet-500/20 dark:text-violet-400',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  dot?: boolean;
}

export function Badge({ className, variant = 'default', dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </span>
  );
}
