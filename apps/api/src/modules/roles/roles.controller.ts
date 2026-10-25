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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Paginated, Role, RoleSummary } from '@wmcms/shared';

import { Req } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { CreateRoleDto } from './dto/create-role.dto';
import { QueryRoleDto } from './dto/query-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('角色')
@ApiBearerAuth('admin')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('role:view')
  @ApiOperation({ summary: '角色分页列表（含权限与管理员数量）' })
  list(@Query() query: QueryRoleDto): Promise<Paginated<Role>> {
    return this.rolesService.list(query);
  }

  @Get('options')
  @ApiOperation({ summary: '角色精简列表（登录即可，供选择器使用）' })
  options(): Promise<RoleSummary[]> {
    return this.rolesService.options();
  }

  @Get(':id')
  @RequirePermissions('role:view')
  @ApiOperation({ summary: '角色详情' })
  @ApiParam({ name: 'id', description: '角色 ID' })
  get(@Param('id') id: string): Promise<Role> {
    return this.rolesService.get(id);
  }

  @Post()
  @RequirePermissions('role:create')
  @ApiOperation({ summary: '新建角色（permissionCodes 全量设置）' })
  create(@Body() dto: CreateRoleDto, @Req() req: AuthenticatedRequest): Promise<Role> {
    return this.rolesService.create(dto, req);
  }

  @Patch(':id')
  @RequirePermissions('role:update')
  @ApiOperation({ summary: '编辑角色（编码不可修改，权限全量替换）' })
  @ApiParam({ name: 'id', description: '角色 ID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Role> {
    return this.rolesService.update(id, dto, req);
  }

  @Delete(':id')
  @RequirePermissions('role:delete')
  @ApiOperation({ summary: '删除角色（内置角色与仍有管理员的角色不可删除）' })
  @ApiParam({ name: 'id', description: '角色 ID' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<null> {
    return this.rolesService.remove(id, req);
  }
}
