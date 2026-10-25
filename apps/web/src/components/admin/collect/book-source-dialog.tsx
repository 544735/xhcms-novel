'use client';

import type { BookSource, BookSourceInput, CollectSelectors } from '@wmcms/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { collectApi } from '@/lib/api';
import { errorText } from '@/components/admin/novel/novel-utils';

export interface BookSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: BookSource | null;
}

const HTML_EXAMPLE = `{
  "bookTitle": ".book-info h1",
  "bookAuthor": ".author",
  "bookCover": ".cover img",
  "bookSummary": ".intro",
  "chapterLinks": "#list a",
  "chapterTitle": ".content h1",
  "chapterContent": "#content",
  "linkPrefix": "https://example.com"
}`;

const JSON_EXAMPLE = `{
  "listPath": "data",
  "itemsPath": "chapters",
  "titlePath": "title",
  "contentPath": "content"
}`;

/** 书源新建/编辑（selectors 以 JSON 文本编辑） */
export function BookSourceDialog({ open, onOpenChange, source }: BookSourceDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<'html' | 'json'>('html');
  const [baseUrl, setBaseUrl] = React.useState('');
  const [listUrl, setListUrl] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [selectorsText, setSelectorsText] = React.useState('');
  const [errors, setErrors] = React.useState<{ name?: string; baseUrl?: string; selectors?: string }>({});

  React.useEffect(() => {
    if (!open) return;
    setName(source?.name ?? '');
    setType(source?.type ?? 'html');
    setBaseUrl(source?.baseUrl ?? '');
    setListUrl(source?.listUrl ?? '');
    setEnabled(source?.enabled ?? true);
    setSelectorsText(source?.selectors ? JSON.stringify(source.selectors, null, 2) : '');
    setErrors({});
  }, [open, source]);

  const mutation = useMutation({
    mutationFn: (input: BookSourceInput) =>
      source ? collectApi.updateSource(source.id, input) : collectApi.createSource(input),
    onSuccess: async () => {
      toast.success(source ? '书源已更新' : '书源已创建');
      await queryClient.invalidateQueries({ queryKey: ['book-sources'] });
      onOpenChange(false);
    },
    onError: (error) => toast.error('保存失败', { description: errorText(error) }),
  });

  const handleSubmit = () => {
    const next: { name?: string; baseUrl?: string; selectors?: string } = {};
    if (!name.trim()) next.name = '请输入书源名称';
    if (!/^https?:\/\//i.test(baseUrl.trim())) next.baseUrl = '请输入 http(s) 开头的站点地址';

    let selectors: CollectSelectors | null = null;
    if (selectorsText.trim()) {
      try {
        const parsed = JSON.parse(selectorsText) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          next.selectors = 'selectors 必须是 JSON 对象';
        } else {
          selectors = parsed as CollectSelectors;
        }
      } catch {
        next.selectors = 'selectors 不是合法的 JSON';
      }
    }
    setErrors(next);
    if (next.name ?? next.baseUrl ?? next.selectors) return;

    mutation.mutate({
      name: name.trim(),
      type,
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      listUrl: listUrl.trim() || null,
      selectors,
      enabled,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={source ? '编辑书源' : '新建书源'}
      description="书源描述目标站点的抓取规则；保存后可先试采集验证规则。"
      size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            取消
          </Button>
          <Button size="sm" loading={mutation.isPending} onClick={handleSubmit}>
            {source ? '保存修改' : '创建书源'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="名称" required error={errors.name} htmlFor="source-name">
            <Input
              id="source-name"
              value={name}
              maxLength={60}
              placeholder="如：笔趣阁镜像"
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
            />
          </Field>
          <Field label="类型" htmlFor="source-type">
            <Select
              id="source-type"
              value={type}
              onChange={(event) => setType(event.target.value as 'html' | 'json')}
            >
              <option value="html">HTML（CSS 选择器）</option>
              <option value="json">JSON（点号路径）</option>
            </Select>
          </Field>
        </div>

        <Field label="站点地址 baseUrl" required error={errors.baseUrl} htmlFor="source-base">
          <Input
            id="source-base"
            value={baseUrl}
            placeholder="https://example.com"
            onChange={(event) => {
              setBaseUrl(event.target.value);
              if (errors.baseUrl) setErrors((prev) => ({ ...prev, baseUrl: undefined }));
            }}
          />
        </Field>

        <Field label="列表页 listUrl" hint="可选，试采集/正式采集未提供书籍 URL 时使用" htmlFor="source-list">
          <Input
            id="source-list"
            value={listUrl}
            placeholder="https://example.com/list"
            onChange={(event) => setListUrl(event.target.value)}
          />
        </Field>

        <Field
          label="selectors（JSON）"
          error={errors.selectors}
          hint={type === 'html' ? 'HTML 模式使用 CSS 选择器' : 'JSON 模式使用响应字段点号路径'}
          htmlFor="source-selectors"
        >
          <Textarea
            id="source-selectors"
            rows={10}
            value={selectorsText}
            onChange={(event) => {
              setSelectorsText(event.target.value);
              if (errors.selectors) setErrors((prev) => ({ ...prev, selectors: undefined }));
            }}
            placeholder={type === 'html' ? HTML_EXAMPLE : JSON_EXAMPLE}
            className="font-mono text-[12px] leading-5"
          />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">启用书源</p>
            <p className="text-xs text-muted-foreground">停用后不显示在采集选择中</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="启用书源" />
        </div>
      </div>
    </Dialog>
  );
}
