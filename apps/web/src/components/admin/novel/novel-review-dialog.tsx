'use client';

import { NOVEL_AUDIT_LABELS, type NovelAuditStatus, type NovelCard } from '@wmcms/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { novelsApi } from '@/lib/api';
import { errorText } from './novel-utils';

const REVIEW_OPTIONS: { value: Exclude<NovelAuditStatus, 'pending'>; label: string }[] = [
  { value: 'published', label: NOVEL_AUDIT_LABELS.published },
  { value: 'rejected', label: NOVEL_AUDIT_LABELS.rejected },
  { value: 'offline', label: NOVEL_AUDIT_LABELS.offline },
];

export interface NovelReviewDialogProps {
  novel: NovelCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 书籍审核：上架 / 驳回 / 下架 */
export function NovelReviewDialog({ novel, open, onOpenChange }: NovelReviewDialogProps) {
  const queryClient = useQueryClient();
  const [auditStatus, setAuditStatus] = React.useState<Exclude<NovelAuditStatus, 'pending'>>('published');
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setAuditStatus(novel && novel.auditStatus !== 'pending' ? novel.auditStatus : 'published');
    setReason('');
  }, [open, novel]);

  const mutation = useMutation({
    mutationFn: () => novelsApi.review(novel!.id, auditStatus, reason.trim() || undefined),
    onSuccess: async () => {
      toast.success(`已${NOVEL_AUDIT_LABELS[auditStatus]}《${novel?.title ?? ''}》`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['novels'] }),
        queryClient.invalidateQueries({ queryKey: ['novel'] }),
        queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] }),
      ]);
      onOpenChange(false);
    },
    onError: (error) => toast.error('审核失败', { description: errorText(error) }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="书籍审核"
      description={novel ? `《${novel.title}》· ${novel.authorName}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            取消
          </Button>
          <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            确认提交
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="审核结果" htmlFor="novel-review-status">
          <Select
            id="novel-review-status"
            value={auditStatus}
            onChange={(event) =>
              setAuditStatus(event.target.value as Exclude<NovelAuditStatus, 'pending'>)
            }
          >
            {REVIEW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="审核意见"
          hint="驳回或下架时建议填写原因，便于作者修改"
          htmlFor="novel-review-reason"
        >
          <Textarea
            id="novel-review-reason"
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="如：简介含违规内容，请修改后重新提交。"
          />
        </Field>
      </div>
    </Dialog>
  );
}
