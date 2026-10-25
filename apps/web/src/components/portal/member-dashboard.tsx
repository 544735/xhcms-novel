'use client';

import { CalendarDays, Loader2, LogOut, MessageSquare, Save, Sparkles, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PublicMember } from '@wmcms/shared';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { formatDate, formatNumber } from '@/lib/utils';
import { PublicApiError, publicClient } from './public-client';
import { clearMemberToken, getMemberToken } from './member-token';

type CommentStatus = 'pending' | 'approved' | 'rejected';

interface MyComment {
  id: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  article: { id: string; title: string; slug: string } | null;
}

const STATUS_META: Record<CommentStatus, { label: string; className: string }> = {
  pending: { label: '待审核', className: 'bg-warning/10 text-warning' },
  approved: { label: '已通过', className: 'bg-success/10 text-success' },
  rejected: { label: '未通过', className: 'bg-destructive/10 text-destructive' },
};

export interface MemberDashboardProps {
  siteSlug: string;
  basePath: string;
  siteName: string;
}

/**
 * 会员中心：客户端守卫（无 token 跳转登录页）+ 资料卡 + 修改资料 + 我的评论列表。
 * 会员 token 存在 localStorage `wmcms:member_token`，只用于 /public/** 会员接口。
 */
export function MemberDashboard({ siteSlug, basePath, siteName }: MemberDashboardProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'checking' | 'ready' | 'error'>('checking');
  const [profile, setProfile] = useState<PublicMember | null>(null);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const goLogin = useCallback(() => {
    clearMemberToken();
    router.replace(`${basePath}/member/login`);
  }, [basePath, router]);

  useEffect(() => {
    const token = getMemberToken();
    if (!token) {
      goLogin();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [member, myComments] = await Promise.all([
          publicClient.profile(siteSlug, token),
          publicClient.myComments(siteSlug, token),
        ]);
        if (cancelled) return;
        setProfile(member);
        setNickname(member.nickname ?? '');
        setAvatar(member.avatar ?? '');
        setComments(myComments?.items ?? []);
        setCommentTotal(myComments?.total ?? myComments?.items?.length ?? 0);
        setPhase('ready');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof PublicApiError && (error.status === 401 || error.status === 403)) {
          goLogin();
          return;
        }
        setLoadError(error instanceof PublicApiError ? error.message : '资料加载失败，请稍后重试');
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [goLogin, siteSlug]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getMemberToken();
    if (!token) {
      goLogin();
      return;
    }
    if (password && password.length < 6) {
      setSaveError('新密码至少 6 位');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const updated = await publicClient.updateProfile(siteSlug, token, {
        nickname: nickname.trim(),
        avatar: avatar.trim(),
        ...(password ? { password } : {}),
      });
      setProfile(updated);
      setPassword('');
      setSaveSuccess('资料已更新');
    } catch (error) {
      if (error instanceof PublicApiError && (error.status === 401 || error.status === 403)) {
        goLogin();
        return;
      }
      setSaveError(error instanceof PublicApiError ? error.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    clearMemberToken();
    router.push(basePath || '/');
    router.refresh();
  };

  if (phase === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">正在校验登录状态…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium text-foreground">资料加载失败</p>
        <p className="text-xs text-muted-foreground">{loadError ?? '请稍后重试'}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            重试
          </Button>
          <Button variant="ghost" size="sm" onClick={goLogin}>
            重新登录
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      {/* 资料卡 */}
      <aside className="space-y-4">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.nickname ?? profile.username}
              className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
            />
          ) : (
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary ring-2 ring-primary/20">
              {(profile.nickname ?? profile.username).slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">
              {profile.nickname || profile.username}
            </p>
            <p className="text-xs text-muted-foreground">@{profile.username}</p>
            <p className="text-xs text-muted-foreground">{profile.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 text-center">
            <div>
              <p className="flex items-center justify-center gap-1 text-sm font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {formatNumber(profile.points)}
              </p>
              <p className="text-[11px] text-muted-foreground">积分</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{formatNumber(commentTotal)}</p>
              <p className="text-[11px] text-muted-foreground">评论</p>
            </div>
          </div>
          <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {formatDate(profile.createdAt)} 加入 {siteName}
          </p>
          <Button variant="outline" size="sm" className="w-full" onClick={logout}>
            <LogOut className="h-3.5 w-3.5" />
            退出登录
          </Button>
        </div>
      </aside>

      {/* 修改资料 + 我的评论 */}
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            <UserRound className="h-4 w-4 text-primary" />
            修改资料
          </h2>
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label="昵称">
              <Input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="展示昵称"
                maxLength={40}
              />
            </Field>
            <Field label="头像地址" hint="选填，图片 URL">
              <Input
                value={avatar}
                onChange={(event) => setAvatar(event.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="新密码" hint="留空表示不修改，至少 6 位">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••"
                autoComplete="new-password"
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? '保存中…' : '保存修改'}
              </Button>
            </div>
            {saveError ? (
              <p className="sm:col-span-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {saveError}
              </p>
            ) : null}
            {saveSuccess ? (
              <p className="sm:col-span-2 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                {saveSuccess}
              </p>
            ) : null}
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 flex items-center justify-between gap-2 text-base font-semibold tracking-tight text-foreground">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              我的评论
            </span>
            <span className="text-xs font-normal text-muted-foreground">共 {commentTotal} 条</span>
          </h2>
          {comments.length ? (
            <ul className="divide-y divide-border">
              {comments.map((comment) => {
                const meta = STATUS_META[comment.status];
                return (
                  <li key={comment.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                      {comment.content}
                    </p>
                    {comment.article ? (
                      <Link
                        href={`${basePath}/article/${comment.article.slug}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        评论于《{comment.article.title}》
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              还没有评论，去文章页参与讨论吧～
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
