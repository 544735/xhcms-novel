'use client';

import type { AuthorProfile, AuthorStatus } from '@wmcms/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { authorApplicationsApi } from '@/lib/api';
import { AUTHOR_STATUS_LABELS, errorText } from '@/components/admin/novel/novel-utils';
import { AuthorStatusBadge } from '@/components/admin/novel/novel-badges';

export type AuthorApplicationItem = AuthorProfile & {
  member?: { id: string; username: string; nickname: string | null; email: string };
};

export interface AuthorReviewDialogProps {
  application: AuthorApplicationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 作者申请审核：通过 / 驳回（含原因） */
export function AuthorReviewDialog({ application, open, onOpenChange }: AuthorReviewDialogProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<Exclude<AuthorStatus, 'pending'>>('approved');
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setStatus('approved');
    setReason('');
  }, [open, application]);

  const mutation = useMutation({
    mutationFn: () =>
      authorApplicationsApi.review(application!.id, status, reason.trim() || undefined),
    onSuccess: async () => {
      toast.success(status === 'approved' ? '作者申请已通过' : '作者申请已驳回');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['author-applications'] }),
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
      title="作者申请审核"
      description={application ? `笔名：${application.penName}` : undefined}
      size="md"
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
      {application ? (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-4 text-xs leading-relaxed">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{application.penName}</span>
              <AuthorStatusBadge status={application.status} />
            </div>
            <p className="text-muted-foreground">
              会员：{application.member?.nickname ?? application.member?.username ?? application.memberId}
              {application.member?.email ? ` · ${application.member.email}` : ''}
            </p>
            <p className="text-muted-foreground">联系方式：{application.contact || '—'}</p>
            <p className="text-muted-foreground">申请时间：{application.appliedAt}</p>
            {application.bio ? (
              <p className="text-foreground/80">简介：{application.bio}</p>
            ) : null}
            {application.rejectReason ? (
              <p className="text-destructive">上次驳回原因：{application.rejectReason}</p>
            ) : null}
          </div>

          <Field label="审核结果" htmlFor="author-review-status">
            <Select
              id="author-review-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as Exclude<AuthorStatus, 'pending'>)}
            >
              <option value="approved">{AUTHOR_STATUS_LABELS.approved}</option>
              <option value="rejected">{AUTHOR_STATUS_LABELS.rejected}</option>
            </Select>
          </Field>
          <Field label="审核意见" hint="驳回时建议填写原因，会员可在门户看到" htmlFor="author-review-reason">
            <Textarea
              id="author-review-reason"
              rows={3}
              maxLength={200}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="如：简介信息不完整，请补充后重新申请。"
            />
          </Field>
        </div>
      ) : null}
    </Dialog>
  );
}
