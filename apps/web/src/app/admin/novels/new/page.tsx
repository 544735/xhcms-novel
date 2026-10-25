'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NovelForm } from '@/components/admin/novel/novel-form';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

export default function NewNovelPage() {
  const router = useRouter();

  return (
    <PermissionGate permission="novel:create">
      <div className="space-y-6">
        <PageHeader
          title="新建书籍"
          description="创建书籍后会进入编辑页，可在其中继续维护分卷与章节。"
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => router.push('/admin/novels')}
            >
              返回列表
            </Button>
          }
        />
        <NovelForm mode="create" />
      </div>
    </PermissionGate>
  );
}
