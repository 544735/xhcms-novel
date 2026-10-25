import { SetMetadata } from '@nestjs/common';

export const IS_RAW_RESPONSE_KEY = 'wmcms:isRawResponse';

/** 跳过统一响应包装（sitemap.xml / rss.xml 等） */
export const RawResponse = () => SetMetadata(IS_RAW_RESPONSE_KEY, true);
