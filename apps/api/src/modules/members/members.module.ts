import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { PublicMembersController } from './public-members.controller';
import { MembersService } from './members.service';

@Module({
  controllers: [MembersController, PublicMembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
