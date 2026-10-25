'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface SearchBoxProps {
  /** 站点前缀：'' 或 '/life' */
  basePath?: string;
  defaultValue?: string;
  variant?: 'header' | 'hero';
  placeholder?: string;
  className?: string;
}

/**
 * 门户搜索框：提交后跳转 `{basePath}/search?q=...`。
 * 无 JS 时也能通过原生 form 提交（action 指向搜索页）。
 */
export function SearchBox({
  basePath = '',
  defaultValue = '',
  variant = 'header',
  placeholder = '搜索文章、标签…',
  className,
}: SearchBoxProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = value.trim();
    if (!keyword) return;
    router.push(`${basePath}/search?q=${encodeURIComponent(keyword)}`);
  };

  if (variant === 'hero') {
    return (
      <form
        onSubmit={submit}
        action={`${basePath}/search`}
        role="search"
        className={`flex w-full max-w-xl items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-card ${className ?? ''}`}
      >
        <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label="搜索关键词"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        <button
          type="submit"
          className="h-9 shrink-0 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          搜索
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={submit}
      action={`${basePath}/search`}
      role="search"
      className={`flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors focus-within:border-primary/50 ${className ?? ''}`}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <input
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label="搜索关键词"
        className="h-6 w-28 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70 sm:w-36"
      />
      <button type="submit" className="sr-only">
        搜索
      </button>
    </form>
  );
}
