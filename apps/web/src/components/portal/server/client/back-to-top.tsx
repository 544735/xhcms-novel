'use client';

import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';

/** 返回顶部：滚动超过 400px 才出现 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="返回顶部"
      title="返回顶部"
      className="fixed bottom-6 right-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-card transition-colors hover:border-primary/50 hover:text-primary sm:bottom-8 sm:right-6"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
