import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  trend?: number;
  accent?: 'primary' | 'emerald' | 'amber' | 'sky' | 'violet' | 'rose';
  className?: string;
}

const accents = {
  primary: 'from-indigo-500/15 to-violet-500/5 text-primary',
  emerald: 'from-emerald-500/15 to-teal-500/5 text-emerald-600 dark:text-emerald-400',
  amber: 'from-amber-500/15 to-orange-500/5 text-amber-600 dark:text-amber-400',
  sky: 'from-sky-500/15 to-cyan-500/5 text-sky-600 dark:text-sky-400',
  violet: 'from-violet-500/15 to-fuchsia-500/5 text-violet-600 dark:text-violet-400',
  rose: 'from-rose-500/15 to-pink-500/5 text-rose-600 dark:text-rose-400',
};

export function StatCard({ title, value, icon: Icon, hint, trend, accent = 'primary', className }: StatCardProps) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-float',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        {Icon ? (
          <div className={cn('rounded-xl bg-gradient-to-br p-2.5', accents[accent])}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {typeof trend === 'number' ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium',
              positive ? 'bg-success/10 text-success dark:text-emerald-400' : 'bg-destructive/10 text-destructive',
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        ) : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}
