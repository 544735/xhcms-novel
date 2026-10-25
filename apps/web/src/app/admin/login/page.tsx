'use client';

import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Sparkles, UserRound, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { tokenStorage } from '@/lib/tokens';

const HIGHLIGHTS = [
  { icon: Sparkles, title: '多站点 & 主题模板', desc: '一套后台管理多个站点，主题随时切换' },
  { icon: Zap, title: '插件化内容增强', desc: '钩子机制支持 SEO 分析、自动目录等扩展' },
  { icon: ShieldCheck, title: 'RBAC 权限体系', desc: '角色、权限点、站点授权三级隔离' },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (tokenStorage.getAccess()) {
      router.replace('/admin');
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('请输入账号和密码');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await login(username.trim(), password);
      toast.success(`欢迎回来，${user.nickname ?? user.username}`);
      router.replace('/admin');
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : '登录失败，请稍后重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* 品牌区 */}
      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div className="absolute inset-0 hero-mesh opacity-90" />
        <div className="absolute inset-0 dot-grid opacity-[0.18]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 text-base font-bold text-white shadow-glow">
              W
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">XHCMS 2.0</p>
              <p className="text-[11px] text-slate-400">NestJS + Next.js 全栈内容管理系统</p>
            </div>
          </div>

          <div className="max-w-lg space-y-8">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                现代化重构版本 · v2.0
              </span>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
                把内容生产力，
                <br />
                交给一套更现代的系统
              </h1>
              <p className="text-sm leading-relaxed text-slate-400">
                从栏目文章、媒体资源到会员互动、插件扩展，XHCMS 2.0 用统一的类型契约与模块化架构，
                让内容团队专注于内容，让工程团队专注于演进。
              </p>
            </div>

            <ul className="space-y-4">
              {HIGHLIGHTS.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-indigo-300">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-6 text-[11px] text-slate-500">
            <span>© 2026 XHCMS</span>
            <span className="h-1 w-1 rounded-full bg-slate-700" />
            <span>TypeScript 全栈</span>
            <span className="h-1 w-1 rounded-full bg-slate-700" />
            <span>Prisma · SQLite</span>
          </div>
        </div>
      </div>

      {/* 表单区 */}
      <div className="relative flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 text-sm font-bold text-white">
              W
            </span>
            <p className="text-sm font-semibold tracking-tight">XHCMS 2.0</p>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">登录管理后台</h2>
            <p className="text-sm text-muted-foreground">使用管理员账号继续，凭据由超级管理员分配。</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-foreground">
                账号
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="admin"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="pl-9"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                密码
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-9 pr-9"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </div>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? '正在登录…' : '登录'}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">演示账号</p>
            <div className="mt-2 space-y-1 font-mono text-[11px] text-foreground/80">
              <p>
                admin <span className="text-muted-foreground">/</span> Admin@123456
                <span className="ml-1.5 rounded bg-primary/10 px-1 py-0.5 font-sans text-[10px] text-primary">
                  超管
                </span>
              </p>
              <p>
                editor <span className="text-muted-foreground">/</span> Editor@123456
                <span className="ml-1.5 rounded bg-muted px-1 py-0.5 font-sans text-[10px] text-muted-foreground">
                  编辑
                </span>
              </p>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              账号由 `pnpm db:seed` 生成，可在 apps/api/.env 中通过 SEED_*_PASSWORD 覆盖。
            </p>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            登录即表示你同意遵守站点的内容管理规范
          </p>
        </div>
      </div>
    </div>
  );
}
