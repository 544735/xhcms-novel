'use client';

import { BookOpen, KeyRound, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { memberClient } from '@/components/portal/client/member-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { tokenStorage } from '@/lib/tokens';

type AuthTab = 'login' | 'register';

export interface MemberLoginFormProps {
  siteSlug: string;
  basePath: string;
  siteName?: string;
}

/**
 * 门户会员登录 / 注册（Tab 切换）。
 * 成功后把会员 token 写入 localStorage（wmcms:member_token，与管理员 token 隔离）并跳转会员中心。
 */
export function MemberLoginForm({ siteSlug, basePath, siteName }: MemberLoginFormProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState<AuthTab>('login');
  const [error, setError] = React.useState<string | null>(null);

  // 登录
  const [account, setAccount] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [loggingIn, setLoggingIn] = React.useState(false);

  // 注册
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [registerPassword, setRegisterPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [registering, setRegistering] = React.useState(false);

  React.useEffect(() => {
    if (tokenStorage.getMemberToken()) {
      router.replace(`${basePath}/member`);
    }
  }, [router, basePath]);

  const afterAuth = (token: string, name: string) => {
    tokenStorage.setMemberToken(token);
    toast.success(`欢迎，${name}`);
    router.push(`${basePath}/member`);
    router.refresh();
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!account.trim() || !loginPassword) {
      setError('请输入账号和密码');
      return;
    }
    setLoggingIn(true);
    try {
      const result = await memberClient.login(siteSlug, {
        account: account.trim(),
        password: loginPassword,
      });
      afterAuth(result.token, result.member.nickname ?? result.member.username);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : '登录失败，请稍后重试');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
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
    if (registerPassword.length < 8) {
      setError('密码至少 8 位');
      return;
    }
    if (registerPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setRegistering(true);
    try {
      const result = await memberClient.register(siteSlug, {
        username: username.trim(),
        email: email.trim(),
        password: registerPassword,
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
      });
      afterAuth(result.token, result.member.nickname ?? result.member.username);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : '注册失败，请稍后重试');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="mb-6 space-y-1 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <BookOpen className="h-3.5 w-3.5" />
          {siteName ? `${siteName} · 会员中心` : '会员中心'}
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">登录 / 注册</h1>
        <p className="text-xs text-muted-foreground">登录后可加入书架、同步阅读进度、充值书币与发表书评</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            会员账号
          </CardTitle>
          <CardDescription>会员账号与后台管理账号互相独立</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(value) => { setTab(value as AuthTab); setError(null); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="justify-center">
                <LogIn className="mr-1 h-3.5 w-3.5" />
                登录
              </TabsTrigger>
              <TabsTrigger value="register" className="justify-center">
                <UserPlus className="mr-1 h-3.5 w-3.5" />
                注册
              </TabsTrigger>
            </TabsList>

            {error ? (
              <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            ) : null}

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="mt-4 space-y-4">
                <Field label="账号" required hint="支持用户名或邮箱">
                  <Input
                    value={account}
                    onChange={(event) => setAccount(event.target.value)}
                    placeholder="用户名 / 邮箱"
                    autoComplete="username"
                    disabled={loggingIn}
                  />
                </Field>
                <Field label="密码" required>
                  <Input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    disabled={loggingIn}
                  />
                </Field>
                <Button type="submit" className="w-full" disabled={loggingIn}>
                  {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  {loggingIn ? '登录中…' : '登录'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="mt-4 space-y-4">
                <Field label="用户名" required hint="字母、数字、下划线或中文，2-30 位">
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="登录用户名"
                    autoComplete="username"
                    maxLength={30}
                    disabled={registering}
                  />
                </Field>
                <Field label="邮箱" required>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={120}
                    disabled={registering}
                  />
                </Field>
                <Field label="昵称" hint="选填，评论与书架中展示">
                  <Input
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="昵称"
                    maxLength={30}
                    disabled={registering}
                  />
                </Field>
                <Field label="密码" required hint="至少 8 位">
                  <Input
                    type="password"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    placeholder="设置密码"
                    autoComplete="new-password"
                    maxLength={64}
                    disabled={registering}
                  />
                </Field>
                <Field label="确认密码" required>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    maxLength={64}
                    disabled={registering}
                  />
                </Field>
                <Button type="submit" className="w-full" disabled={registering}>
                  {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {registering ? '注册中…' : '注册并登录'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
            继续即表示同意站点的内容规范；注册信息仅用于会员服务。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
