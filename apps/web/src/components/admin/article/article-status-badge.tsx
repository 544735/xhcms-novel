import { ARTICLE_STATUS_LABELS, type ArticleStatus } from '@wmcms/shared';
import { Badge } from '@/components/ui/badge';
import { ARTICLE_STATUS_BADGE } from './article-utils';

export function ArticleStatusBadge({ status }: { status: ArticleStatus }) {
  return (
    <Badge variant={ARTICLE_STATUS_BADGE[status]} dot>
      {ARTICLE_STATUS_LABELS[status]}
    </Badge>
  );
}
