import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'wmcms:isPublic';

/** 标记接口无需管理端登录（门户公开接口 / 登录接口） */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
