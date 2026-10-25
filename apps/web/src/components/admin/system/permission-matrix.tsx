'use client';

import type { PermissionGroup } from '@wmcms/shared';
import { CheckCheck, RotateCcw } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PermissionMatrixProps {
  groups: PermissionGroup[];
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}

export function PermissionMatrix({ groups, value, onChange, disabled }: PermissionMatrixProps) {
  const selected = React.useMemo(() => new Set(value), [value]);
  const allCodes = React.useMemo(() => groups.flatMap((group) => group.items.map((item) => item.code)), [groups]);
  const allSelected = allCodes.length > 0 && allCodes.every((code) => selected.has(code));

  const toggleCode = (code: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(Array.from(next));
  };

  const toggleGroup = (group: PermissionGroup) => {
    if (disabled) return;
    const codes = group.items.map((item) => item.code);
    const groupAllSelected = codes.every((code) => selected.has(code));
    const next = new Set(selected);
    for (const code of codes) {
      if (groupAllSelected) next.delete(code);
      else next.add(code);
    }
    onChange(Array.from(next));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          已选择 <span className="font-semibold text-foreground">{value.length}</span> / {allCodes.length} 项权限
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !allCodes.length}
            onClick={() => onChange(allSelected ? [] : [...allCodes])}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {allSelected ? '取消全选' : '全选'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !value.length}
            onClick={() => onChange([])}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            清空
          </Button>
        </div>
      </div>

      {groups.length ? (
        <div className="space-y-3">
          {groups.map((group) => {
            const codes = group.items.map((item) => item.code);
            const groupSelectedCount = codes.filter((code) => selected.has(code)).length;
            const groupAllSelected = codes.length > 0 && groupSelectedCount === codes.length;

            return (
              <div key={group.group} className="rounded-xl border border-border/70">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{group.group}</p>
                    <span className="text-[11px] text-muted-foreground">
                      {groupSelectedCount}/{codes.length}
                    </span>
                  </div>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={groupAllSelected}
                      onChange={() => toggleGroup(group)}
                      disabled={disabled}
                    />
                    分组全选
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => {
                    const checked = selected.has(item.code);
                    return (
                      <label
                        key={item.code}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted',
                          checked && 'bg-primary/5',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-primary"
                          checked={checked}
                          onChange={() => toggleCode(item.code)}
                          disabled={disabled}
                        />
                        <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
                        <code className="shrink-0 font-mono text-[10px] text-muted-foreground">{item.code}</code>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-8 text-center text-xs text-muted-foreground">权限目录加载失败，暂时无法编辑权限</p>
      )}
    </div>
  );
}
