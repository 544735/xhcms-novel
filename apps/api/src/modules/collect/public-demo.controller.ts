import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';

/** 演示书源 HTML：固定内容，供离线验收试采集/正式采集（不依赖外网） */

interface DemoChapter {
  no: number;
  title: string;
  paragraphs: string[];
}

const DEMO_CHAPTERS: DemoChapter[] = [
  {
    no: 1,
    title: '第一章 山雨',
    paragraphs: [
      '山里的雨来得没有预兆，前一刻还是晴的，下一刻雾气就从谷底漫上来，把整条石板路吞了进去。',
      '沈砚把斗笠压得更低了一些，脚下的泥水没过鞋面。他记得老人说过，雾隐山的雨里藏着东西——不是野兽，是比野兽更古老的东西。',
      '走到半山腰时，他听见身后传来极轻的脚步声，像是有人踩在湿透的落叶上，一步，又一步，始终保持着同样的距离。',
      '他没有回头。进山之前，师父唯一强调过的规矩，就是不要回头。',
    ],
  },
  {
    no: 2,
    title: '第二章 夜行',
    paragraphs: [
      '夜色降下来之后，山道两侧的灯笼次第亮了。那些灯笼没有灯芯，却一明一暗地呼吸着，把影子拉得很长。',
      '沈砚在第七盏灯下停住。灯下的石阶上刻着一个极小的「渡」字，笔画里积着陈年的灰。',
      '他从怀里取出那半块铜牌，铜牌背面也有一个同样的字。两相对上的瞬间，风停了，雾散了，远处出现一座本该不存在的城。',
      '城门开着。门里传来雨声——可这里明明是晴天。',
    ],
  },
];

const BOOK_HTML = `<html><body>
  <h1 class="book-title">雾隐山河</h1>
  <span class="book-author">测试作者</span>
  <img class="book-cover" src="/covers/wu-du-lai-xin.svg" />
  <div class="book-summary">一个用于采集演示的故事简介。</div>
  <ul class="chapter-list">
    <li><a href="http://127.0.0.1:4000/api/v1/public/demo/collect/chapter/1">第一章 山雨</a></li>
    <li><a href="http://127.0.0.1:4000/api/v1/public/demo/collect/chapter/2">第二章 夜行</a></li>
  </ul>
</body></html>`;

function renderChapterHtml(chapter: DemoChapter): string {
  const body = chapter.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');
  return `<html><body><h1 class="chapter-title">${chapter.title}</h1><div class="chapter-content">${body}</div></body></html>`;
}

/** 门户公开演示接口：模拟一个可被采集的书籍页/章节页 */
@ApiTags('门户-采集演示')
@Public()
@RawResponse()
@Controller('public/demo/collect')
export class PublicCollectDemoController {
  @Get('book')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: '演示采集书籍页（HTML，含书名/作者/封面/简介/章节目录）' })
  book(): string {
    return BOOK_HTML;
  }

  @Get('chapter/:no')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiParam({ name: 'no', description: '章节序号（1 或 2）', example: '1' })
  @ApiOperation({ summary: '演示采集章节页（HTML，含章节标题与正文）' })
  chapter(@Param('no') no: string): string {
    const index = Number(no);
    const chapter = DEMO_CHAPTERS.find((item) => item.no === index);
    if (!chapter) throw new NotFoundException('演示章节不存在');
    return renderChapterHtml(chapter);
  }
}
