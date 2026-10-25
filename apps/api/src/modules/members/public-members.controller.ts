import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Comment, Paginated, PublicMember } from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentMember } from '../../common/decorators/current-user.decorator';
import { MemberAuthGuard } from '../../common/guards/member-auth.guard';
import { PageQueryDto } from '../../common/dto/pagination.dto';
import type { AuthMember } from '../../common/types';
import { MembersService, type MemberLoginResult } from './members.service';
import { LoginMemberDto, RegisterMemberDto, UpdateMemberProfileDto } from './dto/member-auth.dto';

@ApiTags('门户-会员')
@Public()
@ApiParam({ name: 'siteSlug', description: '站点 slug' })
@Controller('public/sites/:siteSlug/members')
export class PublicMembersController {
  constructor(private readonly members: MembersService) {}

  @Post('register')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: '会员注册（20 次/分钟）' })
  register(
    @Param('siteSlug') siteSlug: string,
    @Body() dto: RegisterMemberDto,
  ): Promise<MemberLoginResult> {
    return this.members.register(siteSlug, dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: '会员登录（account 支持用户名或邮箱，10 次/分钟）' })
  login(
    @Param('siteSlug') siteSlug: string,
    @Body() dto: LoginMemberDto,
  ): Promise<MemberLoginResult> {
    return this.members.login(siteSlug, dto);
  }

  @Get('profile')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '会员资料（需 Bearer 会员 token）' })
  profile(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
  ): Promise<PublicMember> {
    return this.members.profile(siteSlug, member.id);
  }

  @Patch('profile')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '更新会员资料（昵称 / 头像 / 密码）' })
  updateProfile(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Body() dto: UpdateMemberProfileDto,
  ): Promise<PublicMember> {
    return this.members.updateProfile(siteSlug, member.id, dto);
  }

  @Get('comments')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '我的评论（需 Bearer 会员 token）' })
  myComments(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Query() query: PageQueryDto,
  ): Promise<Paginated<Comment>> {
    return this.members.myComments(siteSlug, member.id, query);
  }
}
