import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { PublicCommentsController } from './public-comments.controller';
import { CommentsService } from './comments.service';

@Module({
  controllers: [CommentsController, PublicCommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
