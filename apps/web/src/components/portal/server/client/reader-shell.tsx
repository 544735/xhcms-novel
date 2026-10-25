'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Lock,
  Minus,
  Plus,
  Settings2,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import type { ChapterContent, NovelCatalog } from '@wmcms/shared';
import { readerApi, ApiError } from '@/lib/api';
import { tokenStorage } from '@/lib/tokens';
import type { ReaderBackground, ReaderSkin } from '@/themes/types';

const SETTINGS_KEY = 'wmcms:reader_settings';

interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  background: ReaderBackground;
  width: number;
}

interface BackgroundStyle {
  page: string;
  toolbar: string;
  muted: string;
  panel: string;
  border: string;
}

/** 阅读器背景皮肤（Tailwind 类必须是字面量，便于构建时扫描） */
const BACKGROUNDS: Record<ReaderBackground, BackgroundStyle> = {
  paper: {
    page: 'bg-[#f7f3e9] text-[#3f3428]',
    toolbar: 'border-b border-[#e3dccb] bg-[#f7f3e9]/95 text-[#3f3428]',
    muted: 'text-[#8a7d63]',
    panel: 'bg-[#fbf8f1] text-[#3f3428]',
    border: 'border-[#e3dccb]',
  },
  sepia: {
    page: 'bg-[#f2e8d5] text-[#463525]',
    toolbar: 'border-b border-[#ddcfb4] bg-[#f2e8d5]/95 text-[#463525]',
    muted: 'text-[#8d7758]',
    panel: 'bg-[#f8f1e2] text-[#463525]',
    border: 'border-[#ddcfb4]',
  },
  green: {
    page: 'bg-[#e8f2e4] text-[#2c3a2a]',
    toolbar: 'border-b border-[#cfe0c8] bg-[#e8f2e4]/95 text-[#2c3a2a]',
    muted: 'text-[#6c8266]',
    panel: 'bg-[#f1f7ee] text-[#2c3a2a]',
    border: 'border-[#cfe0c8]',
  },
  dark: {
    page: 'bg-[#0f1115] text-[#c9cdd6]',
    toolbar: 'border-b border-[#252a35] bg-[#0f1115]/95 text-[#c9cdd6]',
    muted: 'text-[#7d879c]',
    panel: 'bg-[#171b23] text-[#c9cdd6]',
    border: 'border-[#252a35]',
  },
  white: {
    page: 'bg-white text-slate-800',
    toolbar: 'border-b border-slate-200 bg-white/95 text-slate-800',
    muted: 'text-slate-500',
    panel: 'bg-slate-50 text-slate-800',
    border: 'border-slate-200',
  },
};

const BACKGROUND_LABELS: { value: ReaderBackground; label: string; swatch: string }[] = [
  { value: 'paper', label: '米黄', swatch: 'bg-[#f7f3e9]' },
  { value: 'sepia', label: '羊皮', swatch: 'bg-[#f2e8d5]' },
  { value: 'green', label: '护眼', swatch: 'bg-[#e8f2e4]' },
  { value: 'dark', label: '夜间', swatch: 'bg-[#0f1115]' },
  { value: 'white', label: '纯白', swatch: 'bg-white' },
];

const LINE_HEIGHTS = [1.7, 1.95, 2.2];
const WIDTHS = [720, 860, 1000];

export interface ReaderShellProps {
  siteSlug: string;
  siteName: string;
  basePath: string;
  novelTitle: string;
  novelSlug: string;
  chapter: ChapterContent;
  catalog: NovelCatalog | null;
  skin: ReaderSkin;
  /** 客户端章评（web-admin-system 的 CommentSection） */
  commentSection: ReactNode;
}

/** 正文按空行拆段（后端存纯文本） */
function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 小说阅读器（客户端）。
 * - SSR 已给出章节正文；会员登录且章节为 VIP 时，客户端再带 token 拉一次以获得解锁内容；
 * - 设置（字号/行高/背景/宽度）持久化到 localStorage `wmcms:reader_settings`；
 * - 目录抽屉、上一/下一章、键盘左右键翻页；
 * - 阅读进度每 20% 上报一次（仅会员，readerApi.saveProgress）；
 * - VIP 锁定：展示试读 + 解锁（readerApi.unlockChapter）/ 充值 / 登录入口。
 */
export function ReaderShell({
  siteSlug,
  siteName,
  basePath,
  novelTitle,
  novelSlug,
  chapter,
  catalog,
  skin,
  commentSection,
}: ReaderShellProps) {
  const router = useRouter();
  const [liveChapter, setLiveChapter] = useState<ChapterContent>(chapter);
  const [panel, setPanel] = useState<'none' | 'catalog' | 'settings'>('none');
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 18,
    lineHeight: 1.95,
    background: skin.defaultBackground,
    width: skin.defaultWidth,
  });
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [hasToken, setHasToken] = useState(false);
  const reportedRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 阅读器是 fixed 全屏容器：锁定 body 滚动，避免背景页面跟着滚动
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    setHasToken(Boolean(tokenStorage.getMemberToken()));
  }, []);

  /* ---------------- 读取本地设置 ---------------- */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
        setSettings((prev) => ({
          fontSize: typeof parsed.fontSize === 'number' ? parsed.fontSize : prev.fontSize,
          lineHeight: typeof parsed.lineHeight === 'number' ? parsed.lineHeight : prev.lineHeight,
          background:
            parsed.background && parsed.background in BACKGROUNDS
              ? parsed.background
              : prev.background,
          width: typeof parsed.width === 'number' ? parsed.width : prev.width,
        }));
      }
    } catch {
      /* 忽略损坏的本地设置 */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  /* ---------------- 会员：带 token 升级锁定章节 ---------------- */
  useEffect(() => {
    const token = tokenStorage.getMemberToken();
    if (!token || !chapter.locked) return;
    let cancelled = false;
    readerApi
      .chapter(siteSlug, novelSlug, chapter.chapterNo)
      .then((fresh) => {
        if (!cancelled && !fresh.locked) setLiveChapter(fresh);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [chapter, siteSlug, novelSlug]);

  /* ---------------- 阅读进度 + 顶部进度条 ---------------- */
  useEffect(() => {
    const container = scrollRef.current;
    const compute = () => {
      const scrollTop = container ? container.scrollTop : window.scrollY;
      const total = container
        ? container.scrollHeight - container.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const percent = total <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((scrollTop / total) * 100)));
      setProgressPercent(percent);
      return percent;
    };
    const onScroll = () => {
      const percent = compute();
      const token = tokenStorage.getMemberToken();
      if (!token) return;
      const bucket = Math.floor(percent / 20) * 20;
      if (bucket > reportedRef.current && bucket > 0) {
        reportedRef.current = bucket;
        readerApi
          .saveProgress(siteSlug, {
            novelId: liveChapter.novelId,
            chapterId: liveChapter.id,
            percent: bucket,
          })
          .catch(() => undefined);
      }
    };
    onScroll();
    const target: HTMLElement | Window = container ?? window;
    target.addEventListener('scroll', onScroll as EventListener, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      target.removeEventListener('scroll', onScroll as EventListener);
      window.removeEventListener('resize', onScroll);
    };
  }, [liveChapter.id, liveChapter.novelId, siteSlug]);

  /* ---------------- 键盘翻页 ---------------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowLeft' && liveChapter.prevChapter) {
        router.push(`${basePath}/read/${novelSlug}/${liveChapter.prevChapter.chapterNo}`);
      }
      if (event.key === 'ArrowRight' && liveChapter.nextChapter) {
        router.push(`${basePath}/read/${novelSlug}/${liveChapter.nextChapter.chapterNo}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [basePath, liveChapter.nextChapter, liveChapter.prevChapter, novelSlug, router]);

  const bg = BACKGROUNDS[settings.background] ?? BACKGROUNDS.paper;

  const paragraphs = useMemo(() => splitParagraphs(liveChapter.content), [liveChapter.content]);
  const previewParagraphs = useMemo(
    () => (liveChapter.preview ? splitParagraphs(liveChapter.preview) : []),
    [liveChapter.preview],
  );

  const isLocked = liveChapter.locked;

  const unlock = useCallback(async () => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      await readerApi.unlockChapter(siteSlug, liveChapter.id);
      router.refresh();
    } catch (error) {
      setUnlockError(error instanceof ApiError ? error.message : '解锁失败，请稍后重试');
    } finally {
      setUnlocking(false);
    }
  }, [liveChapter.id, router, siteSlug]);

  const updateSetting = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <div ref={scrollRef} className={`fixed inset-0 z-[100] overflow-y-auto ${bg.page}`}>
      {/* 顶部进度条 */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-black/5">
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 工具栏 */}
      <header className={`sticky top-0 z-40 backdrop-blur ${bg.toolbar}`}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-6">
          <Link
            href={`${basePath}/book/${novelSlug}`}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm hover:bg-black/5"
            aria-label="返回书籍详情"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">详情</span>
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium">{novelTitle}</p>
            <p className={`truncate text-[11px] ${bg.muted}`}>
              {liveChapter.title}
              {liveChapter.wordCount ? ` · ${liveChapter.wordCount} 字` : ''}
              {isLocked ? ' · VIP 章节' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPanel(panel === 'catalog' ? 'none' : 'catalog')}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm hover:bg-black/5"
            aria-label="目录"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">目录</span>
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm hover:bg-black/5"
            aria-label="阅读设置"
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">设置</span>
          </button>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              disabled={!liveChapter.prevChapter}
              onClick={() =>
                liveChapter.prevChapter &&
                router.push(`${basePath}/read/${novelSlug}/${liveChapter.prevChapter.chapterNo}`)
              }
              className="inline-flex h-9 w-8 items-center justify-center rounded-lg hover:bg-black/5 disabled:opacity-30"
              aria-label="上一章"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!liveChapter.nextChapter}
              onClick={() =>
                liveChapter.nextChapter &&
                router.push(`${basePath}/read/${novelSlug}/${liveChapter.nextChapter.chapterNo}`)
              }
              className="inline-flex h-9 w-8 items-center justify-center rounded-lg hover:bg-black/5 disabled:opacity-30"
              aria-label="下一章"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 正文 */}
      <main className={`mx-auto w-full px-5 py-8 sm:px-8 ${skin.wrapperClass}`}>
        <article
          className="mx-auto"
          style={{ maxWidth: `${settings.width}px`, fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
        >
          <h1 className={`mb-2 text-balance font-semibold tracking-tight ${skin.titleClass}`} style={{ fontSize: '1.5em' }}>
            {liveChapter.title}
          </h1>
          <p className={`mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${bg.muted}`}>
            <span>{novelTitle}</span>
            {liveChapter.publishedAt ? <span>{new Date(liveChapter.publishedAt).toLocaleDateString('zh-CN')}</span> : null}
            {liveChapter.views ? <span>{liveChapter.views} 次阅读</span> : null}
            {liveChapter.readingTime ? <span>约 {liveChapter.readingTime} 分钟</span> : null}
          </p>

          <div className={`space-y-4 ${skin.contentClass}`}>
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          {isLocked ? (
            <section className={`mt-10 rounded-2xl border p-6 ${bg.border} ${bg.panel}`}>
              {previewParagraphs.length ? (
                <div className={`mb-5 space-y-4 border-b pb-5 ${bg.border}`}>
                  <p className={`flex items-center gap-1.5 text-xs ${bg.muted}`}>
                    <Sparkles className="h-3.5 w-3.5 text-warning" />
                    本章为 VIP 章节，以下为试读内容
                  </p>
                  {previewParagraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              ) : null}
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
                  <Lock className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold">本章需要解锁后阅读</p>
                  <p className={`text-xs ${bg.muted}`}>
                    本章价格 <span className="font-semibold text-warning">{liveChapter.price} 书币</span>
                    {liveChapter.balance !== null ? ` · 当前余额 ${liveChapter.balance} 书币` : ''}
                  </p>
                </div>
                {unlockError ? <p className="text-xs text-destructive">{unlockError}</p> : null}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {hasToken ? (
                    <button
                      type="button"
                      onClick={unlock}
                      disabled={unlocking}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Lock className="h-4 w-4" />
                      {unlocking ? '解锁中…' : `解锁本章（${liveChapter.price} 书币）`}
                    </button>
                  ) : (
                    <Link
                      href={`${basePath}/member/login`}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      登录后解锁
                    </Link>
                  )}
                  <Link
                    href={`${basePath}/vip`}
                    className={`inline-flex h-10 items-center gap-2 rounded-lg border px-5 text-sm font-medium transition-colors ${bg.border} hover:bg-black/5`}
                  >
                    去充值
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          {/* 上下章 */}
          <nav className="mt-10 grid gap-3 sm:grid-cols-2">
            {liveChapter.prevChapter ? (
              <Link
                href={`${basePath}/read/${novelSlug}/${liveChapter.prevChapter.chapterNo}`}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition-colors hover:border-primary/50 ${bg.border}`}
              >
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className={`block text-[11px] ${bg.muted}`}>上一章</span>
                  <span className="block truncate">{liveChapter.prevChapter.title}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {liveChapter.nextChapter ? (
              <Link
                href={`${basePath}/read/${novelSlug}/${liveChapter.nextChapter.chapterNo}`}
                className={`flex items-center justify-end gap-2 rounded-xl border px-4 py-3 text-sm transition-colors hover:border-primary/50 ${bg.border}`}
              >
                <span className="min-w-0 text-right">
                  <span className={`block text-[11px] ${bg.muted}`}>下一章</span>
                  <span className="block truncate">{liveChapter.nextChapter.title}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Link>
            ) : (
              <span />
            )}
          </nav>

          <div className="mt-6 text-center">
            <Link
              href={`${basePath}/book/${novelSlug}`}
              className={`inline-flex items-center gap-1.5 text-xs ${bg.muted} hover:text-primary`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              返回《{novelTitle}》目录
            </Link>
          </div>

          {/* 章评 */}
          <div className={`mt-12 rounded-2xl border p-5 sm:p-6 ${bg.border} ${bg.panel}`}>
            {commentSection}
          </div>
        </article>
      </main>

      {/* 目录抽屉 */}
      {panel === 'catalog' ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="flex-1 bg-black/40"
            aria-label="关闭目录"
            onClick={() => setPanel('none')}
          />
          <aside className={`flex h-full w-[86vw] max-w-sm flex-col shadow-2xl ${bg.panel}`}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${bg.border}`}>
              <p className="text-sm font-semibold">目录 · 共 {catalog?.totalChapters ?? 0} 章</p>
              <button
                type="button"
                onClick={() => setPanel('none')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {catalog?.volumes?.length ? (
                catalog.volumes.map((volume) => (
                  <div key={volume.id} className="py-2">
                    <p className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${bg.muted}`}>
                      {volume.title}
                    </p>
                    <ul>
                      {volume.chapters.map((item) => {
                        const active = item.chapterNo === liveChapter.chapterNo;
                        return (
                          <li key={item.id}>
                            <Link
                              href={`${basePath}/read/${novelSlug}/${item.chapterNo}`}
                              onClick={() => setPanel('none')}
                              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                                active ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-black/5'
                              }`}
                            >
                              <span className="min-w-0 flex-1 truncate">{item.title}</span>
                              {item.isVip ? <Sparkles className="h-3 w-3 shrink-0 text-warning" /> : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              ) : (
                <p className={`px-2 py-6 text-center text-xs ${bg.muted}`}>目录暂时不可用</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {/* 设置抽屉 */}
      {panel === 'settings' ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="flex-1 bg-black/40"
            aria-label="关闭设置"
            onClick={() => setPanel('none')}
          />
          <aside className={`flex h-full w-[86vw] max-w-sm flex-col shadow-2xl ${bg.panel}`}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${bg.border}`}>
              <p className="text-sm font-semibold">阅读设置</p>
              <button
                type="button"
                onClick={() => setPanel('none')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              <div className="space-y-2">
                <p className={`flex items-center gap-1.5 text-xs font-medium ${bg.muted}`}>
                  <Type className="h-3.5 w-3.5" />
                  字号
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateSetting('fontSize', Math.max(14, settings.fontSize - 1))}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${bg.border} hover:bg-black/5`}
                    aria-label="减小字号"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-14 text-center text-sm">{settings.fontSize}px</span>
                  <button
                    type="button"
                    onClick={() => updateSetting('fontSize', Math.min(26, settings.fontSize + 1))}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${bg.border} hover:bg-black/5`}
                    aria-label="增大字号"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className={`text-xs font-medium ${bg.muted}`}>行高</p>
                <div className="flex items-center gap-2">
                  {LINE_HEIGHTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateSetting('lineHeight', value)}
                      className={`h-9 flex-1 rounded-lg border text-xs transition-colors ${
                        settings.lineHeight === value
                          ? 'border-primary bg-primary/10 text-primary'
                          : `${bg.border} hover:bg-black/5`
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className={`text-xs font-medium ${bg.muted}`}>背景</p>
                <div className="flex flex-wrap items-center gap-2">
                  {BACKGROUND_LABELS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => updateSetting('background', item.value)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                        settings.background === item.value
                          ? 'border-primary text-primary'
                          : `${bg.border} ${bg.muted} hover:bg-black/5`
                      }`}
                      aria-pressed={settings.background === item.value}
                    >
                      <span className={`h-4 w-4 rounded-full ring-1 ring-black/10 ${item.swatch}`} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className={`text-xs font-medium ${bg.muted}`}>正文宽度</p>
                <div className="flex items-center gap-2">
                  {WIDTHS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateSetting('width', value)}
                      className={`h-9 flex-1 rounded-lg border text-xs transition-colors ${
                        settings.width === value
                          ? 'border-primary bg-primary/10 text-primary'
                          : `${bg.border} hover:bg-black/5`
                      }`}
                    >
                      {value}px
                    </button>
                  ))}
                </div>
              </div>

              <p className={`text-[11px] leading-relaxed ${bg.muted}`}>
                设置会保存在本机浏览器。左右方向键可切换上一章 / 下一章。
              </p>
            </div>
          </aside>
        </div>
      ) : null}

      <p className={`pb-8 text-center text-[11px] ${bg.muted}`}>
        {siteName} · 沉浸阅读模式
      </p>
    </div>
  );
}
