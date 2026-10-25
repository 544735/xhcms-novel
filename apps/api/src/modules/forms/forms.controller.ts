import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Form, FormSubmission, Paginated } from '@wmcms/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import { CurrentSiteId, Req } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { MarkSubmissionReadDto, QuerySubmissionDto } from './dto/query-submission.dto';

@ApiTags('表单管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '当前站点 ID' })
@SiteScoped()
@Controller('forms')
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get()
  @RequirePermissions('form:view')
  @ApiOperation({ summary: '表单列表（当前站点全部，含提交数）' })
  list(@CurrentSiteId() siteId: string): Promise<Form[]> {
    return this.forms.list(siteId);
  }

  @Get(':id')
  @RequirePermissions('form:view')
  @ApiOperation({ summary: '表单详情' })
  get(@CurrentSiteId() siteId: string, @Param('id') id: string): Promise<Form> {
    return this.forms.get(siteId, id);
  }

  @Post()
  @RequirePermissions('form:create')
  @ApiOperation({ summary: '新建表单（fields 校验 key 唯一与类型合法）' })
  create(
    @CurrentSiteId() siteId: string,
    @Body() dto: CreateFormDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Form> {
    return this.forms.create(siteId, dto, req);
  }

  @Patch(':id')
  @RequirePermissions('form:update')
  @ApiOperation({ summary: '编辑表单' })
  update(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFormDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Form> {
    return this.forms.update(siteId, id, dto, req);
  }

  @Delete(':id')
  @RequirePermissions('form:delete')
  @ApiOperation({ summary: '删除表单（级联删除提交记录）' })
  remove(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.forms.remove(siteId, id, req);
  }

  @Get(':id/submissions')
  @RequirePermissions('form:view')
  @ApiOperation({ summary: '表单提交记录（分页，data 已解析为对象）' })
  submissions(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Query() query: QuerySubmissionDto,
  ): Promise<Paginated<FormSubmission>> {
    return this.forms.submissions(siteId, id, query);
  }

  @Patch('submissions/:submissionId/read')
  @RequirePermissions('form:update')
  @ApiOperation({ summary: '标记提交记录已读 / 未读' })
  markRead(
    @CurrentSiteId() siteId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: MarkSubmissionReadDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<FormSubmission> {
    return this.forms.markRead(siteId, submissionId, dto.read ?? true, req);
  }

  @Delete('submissions/:submissionId')
  @RequirePermissions('form:delete')
  @ApiOperation({ summary: '删除表单提交记录' })
  removeSubmission(
    @CurrentSiteId() siteId: string,
    @Param('submissionId') submissionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.forms.removeSubmission(siteId, submissionId, req);
  }
}
