'use client';

import { useEffect, useState } from 'react';

/** 文章阅读进度条（固定在视口顶部，阅读到 100% 时淡出） */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total <= 0 ? 0 : Math.min(100, Math.max(0, (scrollTop / total) * 100)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1" aria-hidden>
      <div
        className="h-full bg-primary transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 99.5 ? 0 : 1 }}
      />
    </div>
  );
}
