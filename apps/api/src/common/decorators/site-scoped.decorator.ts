import { SetMetadata } from '@nestjs/common';

export const IS_SITE_SCOPED_KEY = 'wmcms:isSiteScoped';

/**
 * 标记站点级接口：必须携带请求头 X-Site-Id，
 * 且当前用户（非超管）必须被授权该站点。
 */
export const SiteScoped = () => SetMetadata(IS_SITE_SCOPED_KEY, true);
