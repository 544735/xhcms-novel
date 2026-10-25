'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  default:
    'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95 disabled:bg-primary/60',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/70 active:bg-secondary/80',
  outline:
    'border border-border bg-card text-foreground shadow-sm hover:bg-muted hover:text-foreground',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  destructive:
    'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 disabled:bg-destructive/60',
  success: 'bg-success text-success-foreground shadow-sm hover:bg-success/90',
  link: 'text-primary underline-offset-4 hover:underline',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-9.5 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-6 text-sm',
  icon: 'h-9 w-9 justify-center p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'default', size = 'md', loading = false, icon, children, disabled, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
