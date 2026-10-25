import { PartialType } from '@nestjs/swagger';
import { CreateArticleDto } from './create-article.dto';

/** 更新文章入参：所有字段可选；tagIds 传值即全量替换关联 */
export class UpdateArticleDto extends PartialType(CreateArticleDto) {}
