'use client';

import { useMutation } from '@tanstack/react-query';
import { PenTool, Send } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { readerApi, ApiError } from '@/lib/api';

export interface AuthorApplyCardProps {
  siteSlug: string;
  onApplied: () => void;
}

/** 作者申请表单（未申请作者身份的会员可见） */
export function AuthorApplyCard({ siteSlug, onApplied }: AuthorApplyCardProps) {
  const [penName, setPenName] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const applyMutation = useMutation({
    mutationFn: () =>
      readerApi.applyAuthor(siteSlug, {
        penName: penName.trim(),
        ...(bio.trim() ? { bio: bio.trim() } : {}),
        ...(contact.trim() ? { contact: contact.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success('作者申请已提交，等待管理员审核');
      onApplied();
    },
    onError: (caught) => {
      const message = caught instanceof ApiError ? caught.message : '申请提交失败，请稍后重试';
      setError(message);
      toast.error(message);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!penName.trim()) {
      setError('请填写作者笔名');
      return;
    }
    if (penName.trim().length > 30) {
      setError('笔名最多 30 个字符');
      return;
    }
    applyMutation.mutate();
  };

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-primary" />
          申请成为作者
        </CardTitle>
        <CardDescription>
          作者可以创建作品、发布章节并参与 VIP 分成。提交后需管理员审核，审核结果会在本页展示。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          ) : null}
          <Field label="作者笔名" required hint="全局唯一，展示在书籍作者位置">
            <Input
              value={penName}
              onChange={(event) => setPenName(event.target.value)}
              placeholder="例如：夜航星"
              maxLength={30}
              disabled={applyMutation.isPending}
            />
          </Field>
          <Field label="作者简介" hint="选填，最多 500 字">
            <Textarea
              rows={4}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="介绍一下你的创作方向与代表作品…"
              maxLength={500}
              disabled={applyMutation.isPending}
            />
          </Field>
          <Field label="联系方式" hint="选填，仅管理员可见（邮箱 / QQ / 微信）">
            <Input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="you@example.com"
              maxLength={120}
              disabled={applyMutation.isPending}
            />
          </Field>
          <Button type="submit" className="w-full" loading={applyMutation.isPending}>
            <Send className="h-4 w-4" />
            提交申请
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
