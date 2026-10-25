'use client';

import { CheckCircle2, Loader2, Send, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { PublicApiError, publicClient } from './public-client';
import { getMemberToken } from './member-token';

export interface CommentFormProps {
  siteSlug: string;
  articleSlug: string;
  /** 会员登录页链接（未登录时引导） */
  loginHref?: string;
}

/**
 * 客户端评论表单。
 * - 未登录：昵称 / 邮箱 / 内容；
 * - 已登录会员：自动携带 localStorage 中的 `wmcms:member_token`，后端据此绑定 memberId 并取昵称；
 * - 提交成功后提示「评论已提交，审核后展示」，并 router.refresh() 拉取最新已审核评论。
 */
export function CommentForm({ siteSlug, articleSlug, loginHref }: CommentFormProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setToken(getMemberToken());
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = content.trim();
    if (trimmed.length < 2) {
      setError('评论内容至少 2 个字');
      return;
    }
    if (!token && !nickname.trim()) {
      setError('请填写昵称');
      return;
    }
    if (!token && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('邮箱格式不正确');
      return;
    }

    setSubmitting(true);
    try {
      await publicClient.submitComment(
        siteSlug,
        articleSlug,
        {
          content: trimmed,
          ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
        },
        token,
      );
      setContent('');
      setSuccess('评论已提交，审核后展示');
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof PublicApiError
          ? submitError.message
          : '评论提交失败，请稍后重试';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">发表评论</p>
        {token ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            已登录会员，将自动以会员身份评论
          </span>
        ) : loginHref ? (
          <a href={loginHref} className="text-xs text-primary hover:underline">
            登录会员可免填昵称 →
          </a>
        ) : null}
      </div>

      {!token ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="昵称" required>
            <Input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="你的昵称"
              maxLength={40}
            />
          </Field>
          <Field label="邮箱" hint="选填，不会公开显示">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              maxLength={120}
            />
          </Field>
        </div>
      ) : null}

      <Field label="评论内容" required>
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="理性发言，友善讨论…"
          rows={4}
          maxLength={2000}
        />
      </Field>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      ) : null}
      {success ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {success}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">评论提交后需审核，通过后展示</p>
        <Button type="submit" disabled={submitting} icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}>
          {submitting ? '提交中…' : '提交评论'}
        </Button>
      </div>
    </form>
  );
}
