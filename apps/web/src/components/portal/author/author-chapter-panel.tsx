'use client';

import type { AuthorNovelItem, ChapterSummary } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import * as React from 'react';
import { AuthorChapterEditorDialog, type ChapterDraftInput } from '@/components/portal/author/author-chapter-editor-dialog';
import { formatWordCount } from '@/components/portal/author/word-count';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { readerApi, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

export interface AuthorChapterPanelProps {
  siteSlug: string;
  novel: AuthorNovelItem;
  /** 章节增删改后通知父组件刷新作品统计 */
  onChanged?: () => void;
  onAuthError?: (error: unknown) => boolean;
}

/** 作者中心：单本作品的章节列表 + 章节编辑器（纯文本） */
export function AuthorChapterPanel({ siteSlug, novel, onChanged, onAuthError }: AuthorChapterPanelProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingChapter, setEditingChapter] = React.useState<ChapterSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ChapterSummary | null>(null);

  const chaptersQuery = useQuery({
    queryKey: ['member', 'author', 'chapters', siteSlug, novel.id, page, pageSize],
    queryFn: () => readerApi.authorChapters(siteSlug, novel.id, page, pageSize),
  });

  React.useEffect(() => {
    if (chaptersQuery.error && onAuthError) onAuthError(chaptersQuery.error);
  }, [chaptersQuery.error, onAuthError]);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['member', 'author', 'chapters', siteSlug, novel.id],
    });
    onChanged?.();
  };

  const saveMutation = useMutation({
    mutationFn: ({ chapterId, input }: { chapterId?: string; input: ChapterDraftInput }) =>
      chapterId
        ? readerApi.updateAuthorChapter(siteSlug, novel.id, chapterId, input)
        : readerApi.createAuthorChapter(siteSlug, novel.id, { ...input, content: input.content ?? '' }),
    onSuccess: (_data, variables) => {
      toast.success(variables.chapterId ? '章节已保存' : '章节已创建');
      invalidate();
      setEditorOpen(false);
      setEditingChapter(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '章节保存失败，请稍后重试');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (chapterId: string) => readerApi.deleteAuthorChapter(siteSlug, novel.id, chapterId),
    onSuccess: () => {
      toast.success('章节已删除');
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '章节删除失败');
    },
  });

  const chapters = chaptersQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <FilePlus2 className="h-4 w-4 text-primary" />
            章节管理 · {novel.title}
          </CardTitle>
          <CardDescription className="mt-1">
            共 {chaptersQuery.data?.total ?? novel.chapterCount} 章 · 累计 {formatWordCount(novel.words)}
            {novel.auditStatus !== 'published' ? ' · 书籍尚未上架，新章节将保存为草稿' : ''}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void chaptersQuery.refetch()}
            disabled={chaptersQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingChapter(null);
              setEditorOpen(true);
            }}
          >
            <FilePlus2 className="h-4 w-4" />
            新建章节
          </Button>
        </div>
      </CardHeader>

      {chaptersQuery.isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : chaptersQuery.isError ? (
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">章节列表加载失败，请稍后重试。</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void chaptersQuery.refetch()}>
            重新加载
          </Button>
        </CardContent>
      ) : !chapters.length ? (
        <CardContent>
          <EmptyState
            icon={FilePlus2}
            title="还没有章节"
            description="从第一章开始创作吧，保存后会自动统计字数。"
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditingChapter(null);
                  setEditorOpen(true);
                }}
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                新建第一章
              </Button>
            }
          />
        </CardContent>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">章节</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>字数</TableHead>
                <TableHead>定价</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chapters.map((chapter) => (
                <TableRow key={chapter.id}>
                  <TableCell>
                    <Badge variant="secondary">第 {chapter.chapterNo} 章</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="line-clamp-1 max-w-56 text-sm text-foreground">{chapter.title}</span>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatWordCount(chapter.wordCount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {chapter.isVip ? (
                      <Badge variant="warning">{chapter.price} 书币</Badge>
                    ) : (
                      <Badge variant="outline">免费</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {chapter.status === 'published' ? (
                      <Badge variant="success" dot>
                        已发布
                      </Badge>
                    ) : (
                      <Badge variant="secondary" dot>
                        草稿
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(chapter.updatedAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingChapter(chapter);
                          setEditorOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(chapter)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border/70 px-4">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={chaptersQuery.data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        </>
      )}

      <AuthorChapterEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingChapter(null);
        }}
        siteSlug={siteSlug}
        novel={novel}
        chapter={editingChapter}
        saving={saveMutation.isPending}
        onSubmit={(input) =>
          saveMutation.mutate({ chapterId: editingChapter?.id, input })
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除章节"
        description={
          deleteTarget
            ? `确定删除「第 ${deleteTarget.chapterNo} 章 ${deleteTarget.title}」吗？该操作不可撤销。`
            : undefined
        }
        confirmText="删除"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMutation.mutateAsync(deleteTarget.id);
          } catch {
            /* 错误提示已由 mutation onError 处理 */
          }
        }}
      />
    </Card>
  );
}
