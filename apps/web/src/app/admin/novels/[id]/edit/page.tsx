'use client';

import type { NovelCard, NovelDetail } from '@wmcms/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { NovelAuditBadge, NovelStatusBadge } from '@/components/admin/novel/novel-badges';
import { NovelChapterManager } from '@/components/admin/novel/novel-chapter-manager';
import { NovelForm } from '@/components/admin/novel/novel-form';
import { errorText, readSearchParam } from '@/components/admin/novel/novel-utils';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { novelsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

export default function EditNovelPage() {
  const params = useParams();
  const rawId = params?.id;
  const novelId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!novelId) return null;

  return (
    <PermissionGate permission="novel:view">
      <EditNovelContent novelId={novelId} />
    </PermissionGate>
  );
}

function EditNovelContent({ novelId }: { novelId: string }) {
  const router = useRouter();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [tab, setTab] = React.useState(() =>
    readSearchParam('tab') === 'chapters' ? 'chapters' : 'info',
  );

  const canUpdateNovel = hasPermission('novel:update');
  const canViewChapters = hasPermission('chapter:view');
  const canCreateChapter = hasPermission('chapter:create');
  const canUpdateChapter = hasPermission('chapter:update');
  const canDeleteChapter = hasPermission('chapter:delete');

  const novelQuery = useQuery<NovelDetail | NovelCard>({
    queryKey: ['novel', novelId, currentSiteId],
    queryFn: () => novelsApi.get(novelId),
  });

  if (novelQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="编辑书籍" description="正在加载书籍信息…" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="p-5">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-4 h-40 w-full" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-4 h-56 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (novelQuery.isError || !novelQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="编辑书籍" />
        <QueryErrorState
          title="书籍加载失败"
          description={errorText(novelQuery.error)}
          onRetry={() => void novelQuery.refetch()}
        />
      </div>
    );
  }

  const novel = novelQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2 normal-case tracking-normal">
            <NovelStatusBadge status={novel.status} />
            <NovelAuditBadge status={novel.auditStatus} />
            {novel.category ? (
              <span className="text-xs text-muted-foreground">分类：{novel.category.name}</span>
            ) : null}
          </span>
        }
        title={novel.title}
        description={`作者：${novel.authorName} · ${novel.chapterCount} 章 · ${novel.words} 字`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => router.push('/admin/novels')}
            >
              返回列表
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void novelQuery.refetch()}
            >
              刷新
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="info">书籍信息</TabsTrigger>
          <TabsTrigger value="chapters">分卷与章节</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-5">
          {canUpdateNovel ? (
            <NovelForm novel={novel} mode="edit" />
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">
              当前账号没有编辑书籍的权限，仅可查看。
            </Card>
          )}
        </TabsContent>
        <TabsContent value="chapters" className="mt-5">
          {canViewChapters ? (
            <NovelChapterManager
              novelId={novelId}
              canUpdateNovel={canUpdateNovel}
              canCreateChapter={canCreateChapter}
              canUpdateChapter={canUpdateChapter}
              canDeleteChapter={canDeleteChapter}
            />
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">
              当前账号没有查看章节的权限，无法管理分卷与章节。
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
