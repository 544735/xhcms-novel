import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flame, Sparkles, Star, Trophy } from 'lucide-react';
import { novelPortalApi } from '@/lib/server-api';
import { getTheme } from '@/themes';
import { SiteBreadcrumb } from '@/themes/shared';
import { getPortalContext } from '../context';
import { PortalLoadError } from '../load-error';

const RANK_TABS = [
  { type: 'hot', label: '热门榜', description: '综合阅读热度', icon: Flame },
  { type: 'new', label: '新书榜', description: '最近上架好书', icon: Sparkles },
  { type: 'favorite', label: '收藏榜', description: '读者收藏最多', icon: Star },
  { type: 'words', label: '字数榜', description: '篇幅最长的作品', icon: Trophy },
] as const;

export type RankType = (typeof RANK_TABS)[number]['type'];

export function normalizeRankType(value: string | undefined): RankType {
  const found = RANK_TABS.find((tab) => tab.type === value);
  return found ? found.type : 'hot';
}

/** 排行榜 /rank?type=hot|new|favorite|words */
export async function RankView({
  basePath,
  siteSlug,
  type,
}: {
  basePath: string;
  siteSlug?: string;
  type: RankType;
}) {
  const result = await getPortalContext(basePath, siteSlug);
  if (result.status === 'not-found') notFound();
  if (result.status === 'error') return <PortalLoadError basePath={basePath} />;

  const { ctx } = result;
  const theme = getTheme(ctx.theme.key);
  const active = RANK_TABS.find((tab) => tab.type === type) ?? RANK_TABS[0];

  const novels = await novelPortalApi.rankings(ctx.site.slug, type, 50);
  if (novels === null) {
    return (
      <div className="container py-12">
        <PortalLoadError basePath={basePath} />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <SiteBreadcrumb
        items={[{ label: '首页', href: basePath || '/' }, { label: '排行榜' }]}
      />

      <header className="mb-6 space-y-2 border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">排行榜</h1>
        <p className="text-xs text-muted-foreground">{active.description} · 每日更新</p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {RANK_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.type}
              href={`${basePath}/rank?type=${tab.type}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                tab.type === type
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      <theme.BookGrid ctx={ctx} novels={novels} variant="rank" emptyText="榜单暂无数据" />

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        榜单按{active.label}规则计算，仅供参考
      </p>
    </div>
  );
}
