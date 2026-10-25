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
import type { AdminUser, Paginated } from '@wmcms/shared';

import { CurrentUser, Req } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('管理员')
@ApiBearerAuth('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('user:view')
  @ApiOperation({ summary: '管理员分页列表（支持 keyword / status）' })
  list(@Query() query: QueryUserDto): Promise<Paginated<AdminUser>> {
    return this.usersService.list(query);
  }

  @Get(':id')
  @RequirePermissions('user:view')
  @ApiOperation({ summary: '管理员详情' })
  @ApiParam({ name: 'id', description: '管理员 ID' })
  get(@Param('id') id: string): Promise<AdminUser> {
    return this.usersService.get(id);
  }

  @Post()
  @RequirePermissions('user:create')
  @ApiOperation({ summary: '新建管理员（可分配角色与站点）' })
  create(
    @Body() dto: CreateUserDto,
    @Req() req: AuthenticatedRequest,
    @CurrentUser() current: AuthContext,
  ): Promise<AdminUser> {
    return this.usersService.create(dto, req, current);
  }

  @Patch(':id')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: '编辑管理员（password 传则重置密码）' })
  @ApiParam({ name: 'id', description: '管理员 ID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
    @CurrentUser() current: AuthContext,
  ): Promise<AdminUser> {
    return this.usersService.update(id, dto, req, current);
  }

  @Patch(':id/status')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: '启用/禁用管理员' })
  @ApiParam({ name: 'id', description: '管理员 ID' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: AuthenticatedRequest,
    @CurrentUser() current: AuthContext,
  ): Promise<AdminUser> {
    return this.usersService.updateStatus(id, dto, req, current);
  }

  @Delete(':id')
  @RequirePermissions('user:delete')
  @ApiOperation({ summary: '删除管理员（不可删除自己与最后一个超管）' })
  @ApiParam({ name: 'id', description: '管理员 ID' })
  remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @CurrentUser() current: AuthContext,
  ): Promise<null> {
    return this.usersService.remove(id, req, current);
  }
}
