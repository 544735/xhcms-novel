'use client';

import type { ChapterStatus, ChapterSummary, NovelVolume } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileUp, Layers, Plus } from 'lucide-react';
import * as React from 'react';
import { RowActions, type RowActionItem } from '@/components/admin/article/row-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { ApiError, chaptersApi, novelsApi } from '@/lib/api';
import { cn, formatDateTime, formatNumber } from '@/lib/utils';
import { ChapterEditorDialog } from './chapter-editor-dialog';
import { ChapterStatusBadge } from './novel-badges';
import { errorText } from './novel-utils';
import { TxtImportDialog } from './txt-import-dialog';
import { VolumeDialog } from './volume-dialog';

export interface NovelChapterManagerProps {
  novelId: string;
  canUpdateNovel: boolean;
  canCreateChapter: boolean;
  canUpdateChapter: boolean;
  canDeleteChapter: boolean;
}

interface VolumeDialogState {
  open: boolean;
  volume: NovelVolume | null;
}

interface ChapterDialogState {
  open: boolean;
  chapter: ChapterSummary | null;
}

/** 书籍编辑页「分卷与章节」：分卷 CRUD + 章节列表 + 章节编辑器 + TXT 导入 */
export function NovelChapterManager({
  novelId,
  canUpdateNovel,
  canCreateChapter,
  canUpdateChapter,
  canDeleteChapter,
}: NovelChapterManagerProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [keyword, setKeyword] = React.useState('');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 350);
  const [statusFilter, setStatusFilter] = React.useState<ChapterStatus | ''>('');
  const [volumeDialog, setVolumeDialog] = React.useState<VolumeDialogState>({ open: false, volume: null });
  const [chapterDialog, setChapterDialog] = React.useState<ChapterDialogState>({ open: false, chapter: null });
  const [importOpen, setImportOpen] = React.useState(false);
  const [deleteChapterTarget, setDeleteChapterTarget] = React.useState<ChapterSummary | null>(null);
  const [deleteVolumeTarget, setDeleteVolumeTarget] = React.useState<NovelVolume | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedKeyword, statusFilter]);

  const volumesQuery = useQuery({
    queryKey: ['novel-volumes', novelId],
    queryFn: () => novelsApi.volumes(novelId),
  });
  const chaptersQuery = useQuery({
    queryKey: ['chapters', novelId, page, pageSize, debouncedKeyword, statusFilter],
    queryFn: () =>
      chaptersApi.list({
        novelId,
        page,
        pageSize,
        keyword: debouncedKeyword || undefined,
        status: statusFilter || undefined,
      }),
  });

  const volumes = volumesQuery.data ?? [];
  const chapters = chaptersQuery.data?.items ?? [];
  const total = chaptersQuery.data?.total ?? 0;
  const chaptersError =
    chaptersQuery.error instanceof ApiError
      ? chaptersQuery.error.message
      : chaptersQuery.isError
        ? '章节加载失败，请稍后重试'
        : null;

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['chapters', novelId] }),
      queryClient.invalidateQueries({ queryKey: ['novel-volumes', novelId] }),
      queryClient.invalidateQueries({ queryKey: ['novel', novelId] }),
      queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] }),
    ]);
  };

  const chapterStatusMutation = useMutation({
    mutationFn: ({ chapter }: { chapter: ChapterSummary }) =>
      chapter.status === 'published' ? chaptersApi.unpublish(chapter.id) : chaptersApi.publish(chapter.id),
    onSuccess: async (_data, variables) => {
      toast.success(variables.chapter.status === 'published' ? '章节已下线' : '章节已发布');
      await refreshAll();
    },
    onError: (error) => toast.error('操作失败', { description: errorText(error) }),
  });

  const removeChapterMutation = useMutation({
    mutationFn: (id: string) => chaptersApi.remove(id),
    onSuccess: async () => {
      toast.success('章节已删除');
      setDeleteChapterTarget(null);
      await refreshAll();
    },
    onError: (error) => {
      toast.error('删除章节失败', { description: errorText(error) });
    },
  });

  const removeVolumeMutation = useMutation({
    mutationFn: (id: string) => novelsApi.removeVolume(id),
    onSuccess: async () => {
      toast.success('分卷已删除');
      setDeleteVolumeTarget(null);
      await refreshAll();
    },
    onError: (error) => {
      toast.error('删除分卷失败', { description: errorText(error) });
    },
  });

  const volumeTitle = (volumeId: string | null) =>
    volumes.find((volume) => volume.id === volumeId)?.title ?? '未分卷';

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>分卷管理</CardTitle>
            <CardDescription className="mt-1">
              按卷组织章节目录；删除分卷前请确认其下章节的处理方式。
            </CardDescription>
          </div>
          {canUpdateNovel ? (
            <Button
              size="sm"
              variant="outline"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setVolumeDialog({ open: true, volume: null })}
            >
              新建分卷
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {volumesQuery.isLoading ? (
            <TableSkeleton rows={3} cols={3} />
          ) : volumesQuery.isError ? (
            <EmptyState
              compact
              title="分卷加载失败"
              description={errorText(volumesQuery.error)}
              action={
                <Button variant="outline" size="sm" onClick={() => void volumesQuery.refetch()}>
                  重试
                </Button>
              }
            />
          ) : !volumes.length ? (
            <EmptyState
              compact
              icon={Layers}
              title="暂无分卷"
              description="分卷可选；也可以直接创建未分卷章节。"
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {volumes.map((volume) => {
                const volumeActions: RowActionItem[] = [];
                if (canUpdateNovel) {
                  volumeActions.push({
                    label: '编辑',
                    icon: <BookOpen className="h-3.5 w-3.5" />,
                    onSelect: () => setVolumeDialog({ open: true, volume }),
                  });
                  volumeActions.push({
                    label: '删除',
                    icon: <BookOpen className="h-3.5 w-3.5" />,
                    danger: true,
                    separatorBefore: true,
                    onSelect: () => setDeleteVolumeTarget(volume),
                  });
                }
                return (
                  <li key={volume.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{volume.title}</p>
                      <p className="text-xs text-muted-foreground">
                        排序 {volume.sort} · {volume.chapters.length} 章
                      </p>
                    </div>
                    {volumeActions.length ? <RowActions items={volumeActions} label="分卷操作" /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>章节列表</CardTitle>
            <CardDescription className="mt-1">共 {total} 章可管理，支持搜索与发布状态筛选。</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreateChapter ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => setChapterDialog({ open: true, chapter: null })}
                >
                  新建章节
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<FileUp className="h-3.5 w-3.5" />}
                  onClick={() => setImportOpen(true)}
                >
                  导入 TXT
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="搜索章节标题…"
              className="w-full sm:w-64"
            />
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ChapterStatus | '')}
              aria-label="章节状态筛选"
              className="w-full sm:w-32"
            >
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </Select>
          </div>

          {chaptersQuery.isLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : chaptersError ? (
            <EmptyState
              icon={BookOpen}
              title="章节加载失败"
              description={chaptersError}
              action={
                <Button variant="outline" size="sm" onClick={() => void chaptersQuery.refetch()}>
                  重新加载
                </Button>
              }
            />
          ) : !chapters.length ? (
            <EmptyState
              icon={BookOpen}
              title={debouncedKeyword || statusFilter ? '没有匹配的章节' : '暂无章节'}
              description={
                debouncedKeyword || statusFilter
                  ? '尝试更换关键词或筛选条件。'
                  : '创建第一章，或通过 TXT 批量导入。'
              }
              action={
                canCreateChapter && !debouncedKeyword && !statusFilter ? (
                  <Button
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => setChapterDialog({ open: true, chapter: null })}
                  >
                    新建章节
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">章节号</TableHead>
                  <TableHead className="min-w-[220px]">标题</TableHead>
                  <TableHead className="w-32">分卷</TableHead>
                  <TableHead className="w-20">字数</TableHead>
                  <TableHead className="w-24">收费</TableHead>
                  <TableHead className="w-24">状态</TableHead>
                  <TableHead className="w-36">更新时间</TableHead>
                  <TableHead className="w-16 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chapters.map((chapter) => {
                  const actions: RowActionItem[] = [];
                  if (canUpdateChapter) {
                    actions.push({
                      label: '编辑',
                      icon: <BookOpen className="h-3.5 w-3.5" />,
                      onSelect: () => setChapterDialog({ open: true, chapter }),
                    });
                    actions.push({
                      label: chapter.status === 'published' ? '下线' : '发布',
                      separatorBefore: true,
                      onSelect: () => chapterStatusMutation.mutate({ chapter }),
                    });
                  }
                  if (canDeleteChapter) {
                    actions.push({
                      label: '删除',
                      danger: true,
                      separatorBefore: true,
                      onSelect: () => setDeleteChapterTarget(chapter),
                    });
                  }
                  return (
                    <TableRow key={chapter.id}>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">#{chapter.chapterNo}</span>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          disabled={!canUpdateChapter}
                          onClick={() => setChapterDialog({ open: true, chapter })}
                          className={cn(
                            'block max-w-[320px] truncate text-left text-sm font-medium text-foreground',
                            canUpdateChapter && 'transition-colors hover:text-primary',
                          )}
                          title={chapter.title}
                        >
                          {chapter.title}
                        </button>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {volumeTitle(chapter.volumeId)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatNumber(chapter.wordCount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {chapter.isVip ? (
                          <span className="text-xs font-medium text-warning">{chapter.price} 书币</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">免费</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChapterStatusBadge status={chapter.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(chapter.updatedAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {actions.length ? (
                          <RowActions items={actions} label="章节操作" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!chaptersQuery.isLoading && !chaptersError && total > 0 ? (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      {volumeDialog.open ? (
        <VolumeDialog
          open
          onOpenChange={(open) => {
            if (!open) setVolumeDialog({ open: false, volume: null });
          }}
          novelId={novelId}
          volume={volumeDialog.volume}
        />
      ) : null}

      {chapterDialog.open ? (
        <ChapterEditorDialog
          open
          onOpenChange={(open) => {
            if (!open) setChapterDialog({ open: false, chapter: null });
          }}
          novelId={novelId}
          volumes={volumes}
          chapter={chapterDialog.chapter}
        />
      ) : null}

      <TxtImportDialog open={importOpen} onOpenChange={setImportOpen} novelId={novelId} />

      <ConfirmDialog
        open={Boolean(deleteChapterTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteChapterTarget(null);
        }}
        title="删除章节"
        description={
          deleteChapterTarget
            ? `确定删除「第 ${deleteChapterTarget.chapterNo} 章 ${deleteChapterTarget.title}」吗？该操作不可撤销。`
            : undefined
        }
        confirmText="删除"
        loading={removeChapterMutation.isPending}
        onConfirm={async () => {
          if (!deleteChapterTarget) return;
          try {
            await removeChapterMutation.mutateAsync(deleteChapterTarget.id);
          } catch {
            /* onError 已提示 */
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteVolumeTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteVolumeTarget(null);
        }}
        title="删除分卷"
        description={
          deleteVolumeTarget
            ? `确定删除分卷「${deleteVolumeTarget.title}」吗？其下章节会由后端按分卷删除规则处理，操作不可撤销。`
            : undefined
        }
        confirmText="删除"
        loading={removeVolumeMutation.isPending}
        onConfirm={async () => {
          if (!deleteVolumeTarget) return;
          try {
            await removeVolumeMutation.mutateAsync(deleteVolumeTarget.id);
          } catch {
            /* onError 已提示 */
          }
        }}
      />
    </div>
  );
}
