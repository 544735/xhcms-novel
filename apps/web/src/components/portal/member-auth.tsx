'use client';

import { KeyRound, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { PublicApiError, publicClient } from './public-client';
import { setMemberToken } from './member-token';

export interface MemberAuthProps {
  siteSlug: string;
  basePath: string;
  siteName: string;
}

type Tab = 'login' | 'register';

/**
 * 会员登录 / 注册（Tab 切换）。
 * 成功后把会员 token 写入 localStorage `wmcms:member_token`，并跳转会员中心。
 */
export function MemberAuth({ siteSlug, basePath, siteName }: MemberAuthProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 登录
  const [account, setAccount] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 注册
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  const afterAuth = (token: string) => {
    setMemberToken(token);
    router.push(`${basePath}/member`);
    router.refresh();
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!account.trim() || !loginPassword) {
      setError('请输入账号和密码');
      return;
    }
    setSubmitting(true);
    try {
      const result = await publicClient.login(siteSlug, {
        account: account.trim(),
        password: loginPassword,
      });
      afterAuth(result.token);
    } catch (loginError) {
      setError(loginError instanceof PublicApiError ? loginError.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('请输入正确的邮箱');
      return;
    }
    if (registerPassword.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    setSubmitting(true);
    try {
      const result = await publicClient.register(siteSlug, {
        username: username.trim(),
        email: email.trim(),
        password: registerPassword,
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
      });
      afterAuth(result.token);
    } catch (registerError) {
      setError(
        registerError instanceof PublicApiError ? registerError.message : '注册失败，请稍后重试',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-1 text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <KeyRound className="h-3 w-3" />
          {siteName} 会员中心
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">登录 / 注册</h1>
        <p className="text-xs text-muted-foreground">登录后可评论、管理个人资料</p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1">
        <button
          type="button"
          onClick={() => {
            setTab('login');
            setError(null);
          }}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'login'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LogIn className="h-3.5 w-3.5" />
          登录
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('register');
            setError(null);
          }}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'register'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          注册
        </button>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      ) : null}

      {tab === 'login' ? (
        <form onSubmit={submitLogin} className="space-y-4">
          <Field label="账号" required hint="用户名或邮箱">
            <Input
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="用户名 / 邮箱"
              autoComplete="username"
            />
          </Field>
          <Field label="密码" required>
            <Input
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {submitting ? '登录中…' : '登录'}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitRegister} className="space-y-4">
          <Field label="用户名" required>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="登录用户名"
              autoComplete="username"
              maxLength={40}
            />
          </Field>
          <Field label="邮箱" required>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>
          <Field label="昵称" hint="选填，评论时展示">
            <Input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="昵称"
              maxLength={40}
            />
          </Field>
          <Field label="密码" required hint="至少 6 位">
            <Input
              type="password"
              value={registerPassword}
              onChange={(event) => setRegisterPassword(event.target.value)}
              placeholder="设置密码"
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {submitting ? '注册中…' : '注册并登录'}
          </Button>
        </form>
      )}
    </div>
  );
}
