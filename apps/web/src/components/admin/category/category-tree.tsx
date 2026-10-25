'use client';

import type { CategoryNode } from '@wmcms/shared';
import { FileText, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { RowActions, type RowActionItem } from '@/components/admin/article/row-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface CategoryTreeProps {
  nodes: CategoryNode[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onCreateChild: (parent: CategoryNode) => void;
  onEdit: (category: CategoryNode) => void;
  onDelete: (category: CategoryNode) => void;
}

/** 栏目树：按父子关系缩进渲染，行内提供增删改操作 */
export function CategoryTree({
  nodes,
  canCreate,
  canUpdate,
  canDelete,
  onCreateChild,
  onEdit,
  onDelete,
}: CategoryTreeProps) {
  if (!nodes.length) return null;
  return (
    <div>
      {nodes.map((node) => (
        <CategoryRow
          key={node.id}
          category={node}
          depth={0}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onCreateChild={onCreateChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

interface CategoryRowProps extends Omit<CategoryTreeProps, 'nodes'> {
  category: CategoryNode;
  depth: number;
}

function CategoryRow({
  category,
  depth,
  canCreate,
  canUpdate,
  canDelete,
  onCreateChild,
  onEdit,
  onDelete,
}: CategoryRowProps) {
  const actions: RowActionItem[] = [];
  if (canCreate) {
    actions.push({
      label: '添加子栏目',
      icon: <Plus className="h-3.5 w-3.5" />,
      onSelect: () => onCreateChild(category),
    });
  }
  actions.push({
    label: '编辑',
    icon: <Pencil className="h-3.5 w-3.5" />,
    disabled: !canUpdate,
    onSelect: () => onEdit(category),
  });
  actions.push({
    label: '删除',
    icon: <Trash2 className="h-3.5 w-3.5" />,
    danger: true,
    separatorBefore: true,
    disabled: !canDelete,
    onSelect: () => onDelete(category),
  });

  return (
    <>
      <div
        className="flex flex-col gap-2 border-b border-border/60 py-3 pr-3 transition-colors last:border-b-0 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
        style={{ paddingLeft: 12 + Math.min(depth, 5) * 18 }}
      >
        <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:mt-0">
            {category.type === 'page' ? (
              <FileText className="h-4 w-4" />
            ) : (
              <FolderTree className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">{category.name}</span>
              <Badge variant={category.type === 'page' ? 'info' : 'secondary'}>
                {category.type === 'page' ? '单页' : '栏目'}
              </Badge>
              <Badge variant={category.status === 'enabled' ? 'success' : 'outline'} dot>
                {category.status === 'enabled' ? '启用' : '停用'}
              </Badge>
              {category.icon ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {category.icon}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              /{category.slug} · {category.articleCount} 篇文章
              {category.children.length ? ` · ${category.children.length} 个子栏目` : ''}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
          {canCreate ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => onCreateChild(category)}
            >
              子栏目
            </Button>
          ) : null}
          <RowActions items={actions} label="栏目操作" />
        </div>
      </div>

      {category.children.length
        ? category.children.map((child) => (
            <CategoryRow
              key={child.id}
              category={child}
              depth={depth + 1}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onCreateChild={onCreateChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        : null}
    </>
  );
}
