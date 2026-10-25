import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Req } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { FormsService } from './forms.service';

@ApiTags('门户-表单')
@Public()
@ApiParam({ name: 'siteSlug', description: '站点 slug' })
@ApiParam({ name: 'formSlug', description: '表单 slug' })
@Controller('public/sites/:siteSlug/forms/:formSlug/submissions')
export class PublicFormsController {
  constructor(private readonly forms: FormsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: '提交表单（20 次/分钟）',
    description: '按表单 fields 校验必填 / 类型 / 长度，仅接收已声明字段，返回 { ok: true }。',
  })
  submit(
    @Param('siteSlug') siteSlug: string,
    @Param('formSlug') formSlug: string,
    @Body() payload: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    return this.forms.publicSubmit(siteSlug, formSlug, payload, req);
  }
}
