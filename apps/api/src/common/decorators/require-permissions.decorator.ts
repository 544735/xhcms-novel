import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'wmcms:requiredPermissions';
export const REQUIRED_ANY_PERMISSIONS_KEY = 'wmcms:requiredAnyPermissions';

/** 需要全部权限码才可访问 */
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, codes);

/** 命中任意一个权限码即可访问 */
export const RequireAnyPermission = (...codes: string[]) =>
  SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, codes);
