'use client';

import * as React from 'react';
import {
  Check,
  Copy,
  Download,
  Github,
  MonitorSmartphone,
  ServerCog,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

const REPO = 'https://github.com/544735/xhcms-novel';
const RAW = `${REPO}/raw/main/scripts`;

const COMMANDS = {
  linux: {
    title: 'Linux / macOS',
    icon: Terminal,
    install: `curl -fsSL ${RAW}/install.sh | bash`,
    check: `curl -fsSL ${RAW}/install.sh | bash -s -- --check`,
  },
  windows: {
    title: 'Windows（PowerShell）',
    icon: MonitorSmartphone,
    install: `powershell -ExecutionPolicy Bypass -c "irm ${RAW}/install.ps1 | iex"`,
    check: `powershell -ExecutionPolicy Bypass -c "& ([scriptblock]::Create((irm ${RAW}/install.ps1))) -Check"`,
  },
} as const;

const DETECTIONS = [
  '操作系统与 CPU 架构（Linux/macOS/Windows、x64/arm64）',
  'Node.js / pnpm / Git 版本是否满足要求',
  'Docker 守护进程是否运行、Docker Compose v2 是否可用',
  '目标目录是否已存在仓库（自动改为拉取更新）',
  '端口 3000 / 4000 占用检测与冲突提示',
  '安装后轮询健康检查，失败时自动输出最近日志',
] as const;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      aria-label="复制命令"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* 剪贴板不可用时忽略 */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? '已复制' : '复制'}
    </button>
  );
}

function CommandCard({
  title,
  install,
  check,
  icon: Icon,
}: {
  title: string;
  install: string;
  check: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">一键安装</p>
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-2.5">
            <code className="flex-1 break-all font-mono text-[12px] leading-relaxed">{install}</code>
            <CopyButton text={install} />
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">仅检测环境</p>
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-2.5">
            <code className="flex-1 break-all font-mono text-[12px] leading-relaxed">{check}</code>
            <CopyButton text={check} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminAboutPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">关于与安装</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            XHCMS Novel 2.0 · NestJS 11 + Next.js 15 + Prisma 6 · PostgreSQL / MySQL 双库可选
          </p>
        </div>
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Github className="h-4 w-4" />
          查看仓库
        </a>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Download, label: '一键拉取并安装', value: 'Docker Compose' },
          { icon: ServerCog, label: '数据库', value: 'PostgreSQL / MySQL 8' },
          { icon: ShieldCheck, label: '安全基线', value: 'CI 漏洞审计门禁' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4">
            <item.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-0.5 text-sm font-medium">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">一键拉取安装</h2>
          <span className="text-xs text-muted-foreground">脚本会自动检测环境并在不满足时给出修复提示</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {Object.values(COMMANDS).map((item) => (
            <CommandCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">自动环境检测项</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          {DETECTIONS.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          首次安装会随机生成数据库密码与三个 JWT 密钥；初始管理员口令写入容器数据卷
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">/data/.seed-credentials.txt</code>
          ，首次登录后请立即修改并删除。
        </p>
      </section>
    </div>
  );
}
