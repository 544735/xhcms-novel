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
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Member, Paginated } from '@wmcms/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import { CurrentSiteId, Req } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { QueryMemberDto } from './dto/query-member.dto';
import { ResetMemberPasswordDto, UpdateMemberStatusDto } from './dto/member-ops.dto';

@ApiTags('会员管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '当前站点 ID' })
@SiteScoped()
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermissions('member:view')
  @ApiOperation({ summary: '会员列表（分页 + 关键字 + 状态）' })
  list(
    @CurrentSiteId() siteId: string,
    @Query() query: QueryMemberDto,
  ): Promise<Paginated<Member>> {
    return this.members.list(siteId, query);
  }

  @Get(':id')
  @RequirePermissions('member:view')
  @ApiOperation({ summary: '会员详情' })
  get(@CurrentSiteId() siteId: string, @Param('id') id: string): Promise<Member> {
    return this.members.get(siteId, id);
  }

  @Post()
  @RequirePermissions('member:create')
  @ApiOperation({ summary: '新建会员' })
  create(
    @CurrentSiteId() siteId: string,
    @Body() dto: CreateMemberDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Member> {
    return this.members.create(siteId, dto, req);
  }

  @Patch(':id')
  @RequirePermissions('member:update')
  @ApiOperation({ summary: '编辑会员（password 传入即重置）' })
  update(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Member> {
    return this.members.update(siteId, id, dto, req);
  }

  @Delete(':id')
  @RequirePermissions('member:delete')
  @ApiOperation({ summary: '删除会员' })
  remove(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.members.remove(siteId, id, req);
  }

  @Patch(':id/status')
  @RequirePermissions('member:update')
  @ApiOperation({ summary: '启用 / 禁用会员' })
  setStatus(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMemberStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Member> {
    return this.members.setStatus(siteId, id, dto.status, req);
  }

  @Post(':id/reset-password')
  @RequirePermissions('member:update')
  @ApiOperation({ summary: '重置会员密码' })
  resetPassword(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Body() dto: ResetMemberPasswordDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.members.resetPassword(siteId, id, dto.password, req);
  }
}
