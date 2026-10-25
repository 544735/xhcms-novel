'use client';

import { useParams } from 'next/navigation';
import { ArticleForm } from '@/components/admin/article/article-form';

export default function EditArticlePage() {
  const params = useParams();
  const rawId = params?.id;
  const articleId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!articleId) return null;

  return <ArticleForm articleId={articleId} />;
}
