'use client';

import type { Plugin } from '@wmcms/shared';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';

export interface PluginConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plugin: Plugin | null;
  saving: boolean;
  onSubmit: (config: Record<string, unknown>) => void;
}

export function PluginConfigDialog({
  open,
  onOpenChange,
  plugin,
  saving,
  onSubmit,
}: PluginConfigDialogProps) {
  const [text, setText] = React.useState('{}');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setText(JSON.stringify(plugin?.config ?? {}, null, 2));
    setError(null);
  }, [open, plugin]);

  const handleSubmit = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text || '{}');
    } catch {
      setError('JSON 格式不合法，请检查括号与引号');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('配置必须是一个 JSON 对象');
      return;
    }
    setError(null);
    onSubmit(parsed as Record<string, unknown>);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={plugin ? `配置插件 · ${plugin.name}` : '配置插件'}
      description="插件配置以 JSON 保存，保存后立即热生效，无需重启服务。"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            保存配置
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        ) : null}

        <Field
          label="配置 JSON"
          hint={
            plugin?.hooks?.length
              ? `该插件注册的钩子：${plugin.hooks.join('、')}`
              : '插件未注册钩子；配置项由插件自身定义'
          }
        >
          <Textarea
            rows={14}
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            className="font-mono text-xs leading-relaxed"
            placeholder='{\n  "enabled": true\n}'
            disabled={saving}
          />
        </Field>

        <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">插件信息</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">标识</dt>
              <dd className="truncate font-mono text-foreground">{plugin?.key ?? '—'}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">版本</dt>
              <dd className="text-foreground">{plugin?.version ?? '—'}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">作者</dt>
              <dd className="truncate text-foreground">{plugin?.author ?? '—'}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">状态</dt>
              <dd className="text-foreground">{plugin?.enabled ? '已启用' : '已停用'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Dialog>
  );
}
