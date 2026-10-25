import { cn, initials } from '@/lib/utils';

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
};

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const dimension = sizes[size];
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? '头像'}
        className={cn('shrink-0 rounded-full border border-border object-cover', dimension, className)}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 font-semibold text-white',
        dimension,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
