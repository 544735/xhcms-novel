'use client';

import type { NovelVolume } from '@wmcms/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { novelsApi } from '@/lib/api';
import { errorText } from './novel-utils';

export interface VolumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  volume?: NovelVolume | null;
}

/** 分卷新建/编辑 */
export function VolumeDialog({ open, onOpenChange, novelId, volume }: VolumeDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState('');
  const [sort, setSort] = React.useState('0');

  React.useEffect(() => {
    if (!open) return;
    setTitle(volume?.title ?? '');
    setSort(String(volume?.sort ?? 0));
  }, [open, volume]);

  const mutation = useMutation({
    mutationFn: () =>
      volume
        ? novelsApi.updateVolume(volume.id, { title: title.trim(), sort: Number(sort) || 0 })
        : novelsApi.createVolume(novelId, { title: title.trim(), sort: Number(sort) || 0 }),
    onSuccess: async () => {
      toast.success(volume ? '分卷已更新' : '分卷已创建');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['novel-volumes', novelId] }),
        queryClient.invalidateQueries({ queryKey: ['novel', novelId] }),
      ]);
      onOpenChange(false);
    },
    onError: (error) => toast.error('保存失败', { description: errorText(error) }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={volume ? '编辑分卷' : '新建分卷'}
      description="分卷用于组织章节目录，可按卷排序。"
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            取消
          </Button>
          <Button
            size="sm"
            loading={mutation.isPending}
            disabled={!title.trim()}
            onClick={() => mutation.mutate()}
          >
            {volume ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="分卷名称" required htmlFor="volume-title">
          <Input
            id="volume-title"
            value={title}
            maxLength={80}
            placeholder="如：第一卷 星海初现"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="排序" hint="数字越小越靠前" htmlFor="volume-sort">
          <Input
            id="volume-sort"
            type="number"
            min={0}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}
