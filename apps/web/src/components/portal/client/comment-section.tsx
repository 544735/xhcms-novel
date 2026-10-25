'use client';

import type { PublicNovelComment } from '@wmcms/shared';
import { CornerDownRight, Loader2, MessageSquare, Send, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { readerApi, ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { tokenStorage } from '@/lib/tokens';

/**
 * 书籍详情 / 阅读器复用的评论区（客户端）。
 *
 * - 评论树由服务端 SSR 传入（仅 approved，已在服务端组装树结构）；
 * - 客户端负责发表评论：会员 token 自动从 localStorage 读取（readerApi 内部注入 Bearer），
 *   未登录时匿名提交（后端按访客记录昵称）；
 * - 提交成功 toast「评论已提交，审核后展示」后 router.refresh() 重新拉取服务端评论树。
 */
export interface CommentSectionProps {
  siteSlug: string;
  novelId: string;
  /** 章评传入章节 ID；书评不传 */
  chapterId?: string | null;
  /** 服务端已审核评论树 */
  comments: PublicNovelComment[];
  /** 站点前缀（'' 或 '/ink'），用于会员登录跳转 */
  basePath?: string;
  /** 自定义登录链接（缺省 `${basePath}/member/login`） */
  loginHref?: string;
  /** 标题，缺省「书评」/「章评」 */
  title?: string;
  className?: string;
}

function countComments(nodes: PublicNovelComment[]): number {
  return nodes.reduce((total, node) => total + 1 + countComments(node.children ?? []), 0);
}

function CommentItem({
  node,
  depth,
  token,
  onSubmit,
  submitting,
}: {
  node: PublicNovelComment;
  depth: number;
  token: string | null;
  onSubmit: (content: string, parentId: string | null) => Promise<void>;
  submitting: boolean;
}) {
  const [replying, setReplying] = React.useState(false);
  const [replyContent, setReplyContent] = React.useState('');

  const handleReply = async () => {
    const trimmed = replyContent.trim();
    if (trimmed.length < 2) return;
    await onSubmit(trimmed, node.id);
    setReplyContent('');
    setReplying(false);
  };

  return (
    <li className="min-w-0">
      <div className="flex gap-3">
        <Avatar size="sm" src={node.avatar} name={node.nickname} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-foreground">{node.nickname}</span>
            <span className="text-[11px] text-muted-foreground">{formatRelative(node.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">
            {node.content}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setReplying((value) => !value)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {replying ? <X className="h-3 w-3" /> : <CornerDownRight className="h-3 w-3" />}
              {replying ? '取消回复' : '回复'}
            </button>
          </div>

          {replying ? (
            <div className="mt-2 space-y-2 rounded-xl border border-border bg-muted/30 p-2.5">
              <Textarea
                rows={3}
                value={replyContent}
                onChange={(event) => setReplyContent(event.target.value)}
                placeholder={`回复 @${node.nickname}`}
                maxLength={1000}
                disabled={submitting}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {token ? '将以会员身份回复' : '匿名回复'}
                </span>
                <Button
                  type="button"
                  size="sm"
                  loading={submitting}
                  disabled={replyContent.trim().length < 2}
                  onClick={() => void handleReply()}
                >
                  <Send className="h-3.5 w-3.5" />
                  提交回复
                </Button>
              </div>
            </div>
          ) : null}

          {(node.children ?? []).length ? (
            <ul className="mt-3 space-y-3 border-l border-border/70 pl-3">
              {node.children.map((child) => (
                <CommentItem
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  token={token}
                  onSubmit={onSubmit}
                  submitting={submitting}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function CommentSection({
  siteSlug,
  novelId,
  chapterId,
  comments,
  basePath = '',
  loginHref,
  title,
  className,
}: CommentSectionProps) {
  const router = useRouter();
  const [token, setToken] = React.useState<string | null>(null);
  const [content, setContent] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setToken(tokenStorage.getMemberToken());
  }, []);

  const loginTarget = loginHref ?? `${basePath}/member/login`;
  const total = React.useMemo(() => countComments(comments), [comments]);

  const submit = async (text: string, parentId: string | null) => {
    setError(null);
    setSubmitting(true);
    try {
      await readerApi.postComment(siteSlug, {
        novelId,
        chapterId: chapterId ?? undefined,
        parentId,
        content: text,
      });
      toast.success('评论已提交，审核后展示');
      if (!parentId) setContent('');
      router.refresh();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : '评论提交失败，请稍后重试';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < 2) {
      setError('评论内容至少 2 个字');
      return;
    }
    await submit(trimmed, null);
  };

  return (
    <section className={className ?? 'space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <MessageSquare className="h-4 w-4 text-primary" />
          {title ?? (chapterId ? '章评' : '书评')}
          <span className="text-xs font-normal text-muted-foreground">（{total}）</span>
        </h2>
        {token ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            已登录会员，将以会员身份评论
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            匿名评论将显示为访客 ·{' '}
            <Link href={loginTarget} className="text-primary hover:underline">
              登录会员
            </Link>
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <Textarea
          rows={4}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={chapterId ? '说说这一章的想法…' : '写下你对这本书的评价…'}
          maxLength={2000}
          disabled={submitting}
        />
        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">评论需审核通过后展示，请理性发言</p>
          <Button type="submit" loading={submitting} disabled={content.trim().length < 2}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            发表评论
          </Button>
        </div>
      </form>

      {comments.length ? (
        <ul className="space-y-4">
          {comments.map((node) => (
            <CommentItem
              key={node.id}
              node={node}
              depth={0}
              token={token}
              onSubmit={submit}
              submitting={submitting}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">还没有评论</p>
          <p className="mt-1 text-xs text-muted-foreground">来发表第一条{chapterId ? '章评' : '书评'}吧</p>
        </div>
      )}
    </section>
  );
}

export default CommentSection;
