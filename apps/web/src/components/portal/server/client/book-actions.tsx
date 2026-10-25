'use client';

import { BookMarked, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, readerApi } from '@/lib/api';
import { tokenStorage } from '@/lib/tokens';

export interface BookActionsProps {
  siteSlug: string;
  novelId: string;
  basePath: string;
  /** 服务端拿不到会员态（token 在 localStorage），初始值仅作占位 */
  initialInBookshelf?: boolean;
  className?: string;
}

/**
 * 书籍详情的「加入书架」操作（客户端）。
 * 会员 token 由 lib/api 的 memberRequest 自动注入；未登录时跳转会员登录页。
 */
export function BookActions({
  siteSlug,
  novelId,
  basePath,
  initialInBookshelf = false,
  className,
}: BookActionsProps) {
  const router = useRouter();
  const [inShelf, setInShelf] = useState(initialInBookshelf);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = tokenStorage.getMemberToken();
    if (!token) {
      setReady(true);
      return;
    }
    readerApi
      .shelf(siteSlug)
      .then((items) => {
        if (!cancelled) setInShelf(items.some((item) => item.novel.id === novelId));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [novelId, siteSlug]);

  const toggle = async () => {
    const token = tokenStorage.getMemberToken();
    if (!token) {
      router.push(`${basePath}/member/login`);
      return;
    }
    setLoading(true);
    try {
      if (inShelf) {
        await readerApi.removeShelf(siteSlug, novelId);
        setInShelf(false);
      } else {
        await readerApi.addShelf(siteSlug, novelId);
        setInShelf(true);
      }
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        router.push(`${basePath}/member/login`);
        return;
      }
      // 失败保持原状态，由上层 toast（如评论组件）或用户重试处理
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={
        className ??
        `inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-60 ${
          inShelf
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-border bg-card text-foreground hover:border-primary/40 hover:text-primary'
        }`
      }
      aria-pressed={inShelf}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : inShelf ? (
        <Check className="h-4 w-4" />
      ) : (
        <BookMarked className="h-4 w-4" />
      )}
      {!ready ? '书架' : inShelf ? '已在书架' : '加入书架'}
    </button>
  );
}
