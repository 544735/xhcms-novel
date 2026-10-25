import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * XHCMS Novel 端到端测试（小说站）
 *
 * 覆盖：健康检查 / 管理员登录与 RBAC / 站点隔离 / 书库与详情 / 免费与 VIP 章节阅读 /
 *       会员注册钱包充值解锁 / 书架与阅读进度 / 书评审核 / 作者申请与作品/章节 /
 *       TXT 导入 / 采集中心（演示书源）/ VIP 管理 / 小说仪表盘 / 审计。
 *
 * 运行：pnpm --filter @wmcms/api test（使用 prisma/test.db 副本，不污染 dev.db）
 * 账号隔离：管理员与运营账号由测试在运行时创建（随机密码），仓库不含任何口令。
 */
describe('XHCMS Novel API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  const prisma = new PrismaClient();
  const randomPassword = () => randomBytes(18).toString('base64url');
  const accounts = {
    admin: { username: 'e2e_novel_admin', password: randomPassword() },
    operator: { username: 'e2e_novel_operator', password: randomPassword() },
  };
  const memberPassword = randomPassword();
  const memberUsername = `e2e_reader_${Date.now().toString(36)}`;

  const tokens: Record<string, string> = {};
  const siteIds: Record<string, string> = {};
  const state: Record<string, string> = {};

  /** 采集 e2e 使用的本地 fixture 服务（避免依赖外部/本机 4000 端口） */
  let collectFixture: Server | null = null;
  let collectBase = '';

  const admin = () => ({ Authorization: `Bearer ${tokens.admin}` });
  const member = () => ({ Authorization: `Bearer ${tokens.member}` });
  const site = (slug: 'books' | 'ink') => ({ 'X-Site-Id': siteIds[slug] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (response: request.Response): any => response.body?.data;

  async function seedAccounts(): Promise<void> {
    const books = await prisma.site.findUniqueOrThrow({ where: { slug: 'books' } });
    const ink = await prisma.site.findUniqueOrThrow({ where: { slug: 'ink' } });
    const roleId = async (code: string) =>
      (await prisma.role.findUniqueOrThrow({ where: { code } })).id;

    await prisma.user.create({
      data: {
        username: accounts.admin.username,
        email: `${accounts.admin.username}@e2e.local`,
        password: hashSync(accounts.admin.password, 10),
        nickname: 'E2E 小说超管',
        isSuperAdmin: true,
        roles: { create: [{ roleId: await roleId('super_admin') }] },
      },
    });
    await prisma.user.create({
      data: {
        username: accounts.operator.username,
        email: `${accounts.operator.username}@e2e.local`,
        password: hashSync(accounts.operator.password, 10),
        nickname: 'E2E 小说运营',
        roles: { create: [{ roleId: await roleId('operator') }] },
        userSites: { create: [{ siteId: books.id }] },
      },
    });
    void ink;
  }

  async function loginAs(username: string, password: string): Promise<Record<string, unknown>> {
    const response = await http
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(201);
    return body(response);
  }

  beforeAll(async () => {
    await seedAccounts();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
    if (collectFixture) {
      await new Promise<void>((resolve) => {
        collectFixture!.close(() => resolve());
      });
      collectFixture = null;
    }
    await prisma.$disconnect();
  });

  describe('健康检查与登录', () => {
    it('GET /health 返回统一信封', async () => {
      const response = await http.get('/api/v1/health').expect(200);
      expect(response.body.code).toBe(0);
      expect(body(response).status).toBe('ok');
    });

    it('管理员登录返回权限与双站点', async () => {
      const data = await loginAs(accounts.admin.username, accounts.admin.password);
      expect(data.accessToken).toBeTruthy();
      expect((data.user as { isSuperAdmin: boolean }).isSuperAdmin).toBe(true);
      expect((data.user as { permissions: string[] }).permissions.length).toBeGreaterThan(40);
      tokens.admin = data.accessToken as string;
      for (const item of (data.user as { sites: { slug: string; id: string }[] }).sites) {
        siteIds[item.slug] = item.id;
      }
      expect(siteIds.books).toBeTruthy();
      expect(siteIds.ink).toBeTruthy();
    });

    it('错误密码返回 401，未登录访问受保护接口返回 401', async () => {
      await http
        .post('/api/v1/auth/login')
        .send({ username: accounts.admin.username, password: randomPassword() })
        .expect(401);
      await http.get('/api/v1/novels').expect(401);
    });

    it('站点上下文缺失返回 400；越权站点返回 403', async () => {
      await http.get('/api/v1/novels').set(admin()).expect(400);

      const operatorData = await loginAs(accounts.operator.username, accounts.operator.password);
      tokens.operator = operatorData.accessToken as string;
      await http
        .get('/api/v1/novels')
        .set({ Authorization: `Bearer ${tokens.operator}`, ...site('books') })
        .expect(200);
      await http
        .get('/api/v1/novels')
        .set({ Authorization: `Bearer ${tokens.operator}`, ...site('ink') })
        .expect(403);
    });
  });

  describe('书库与书籍详情', () => {
    it('书库列表分页返回已上架书籍', async () => {
      const response = await http
        .get('/api/v1/public/sites/books/novels')
        .query({ page: 1, pageSize: 5 })
        .expect(200);
      const data = body(response);
      expect(data.total).toBeGreaterThanOrEqual(4);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items[0].title).toBeTruthy();
      expect(data.items[0].chapterCount).toBeGreaterThan(0);
    });

    it('分类与排行榜可用', async () => {
      const categories = await http
        .get('/api/v1/public/sites/books/novel-categories')
        .expect(200);
      expect(body(categories).length).toBeGreaterThanOrEqual(5);

      const ranking = await http
        .get('/api/v1/public/sites/books/rankings')
        .query({ type: 'hot', limit: 10 })
        .expect(200);
      expect(body(ranking).length).toBeGreaterThanOrEqual(3);
    });

    it('书籍详情返回分卷目录、首章与统计', async () => {
      const response = await http
        .get('/api/v1/public/sites/books/novels/xinghai-bian')
        .expect(200);
      const novel = body(response);
      expect(novel.title).toBe('星海彼岸');
      expect(novel.volumes.length).toBeGreaterThanOrEqual(2);
      expect(novel.chapterCount).toBeGreaterThanOrEqual(8);
      expect(novel.firstChapter.chapterNo).toBe(1);
      state.novelId = novel.id;

      const catalog = await http
        .get('/api/v1/public/sites/books/novels/xinghai-bian/catalog')
        .expect(200);
      expect(body(catalog).volumes.length).toBeGreaterThanOrEqual(2);
    });

    it('搜索与 sitemap/rss 正常', async () => {
      const search = await http
        .get('/api/v1/public/sites/books/search')
        .query({ q: '星' })
        .expect(200);
      expect(body(search).items.length).toBeGreaterThanOrEqual(1);

      const sitemap = await http.get('/api/v1/public/sites/books/sitemap.xml').expect(200);
      expect(sitemap.text).toContain('<urlset');
      expect(sitemap.text).toContain('/book/');
      expect(sitemap.text).toContain('/read/');

      const rss = await http.get('/api/v1/public/sites/books/rss.xml').expect(200);
      expect(rss.text).toContain('<rss');
      expect(rss.text).toContain('<item>');
    });
  });

  describe('章节阅读与 VIP 锁定', () => {
    it('免费章节返回完整正文与阅读时长', async () => {
      const response = await http
        .get('/api/v1/public/sites/books/novels/xinghai-bian/chapters/1')
        .expect(200);
      const chapter = body(response);
      expect(chapter.locked).toBe(false);
      expect(chapter.content.length).toBeGreaterThan(300);
      expect(chapter.readingTime).toBeGreaterThanOrEqual(1);
      expect(chapter.nextChapter.chapterNo).toBe(2);
    });

    it('VIP 章节未登录未解锁时锁定并返回试读', async () => {
      const detail = await http
        .get('/api/v1/public/sites/books/novels/xinghai-bian')
        .expect(200);
      const vipChapter = body(detail).volumes
        .flatMap((volume: { chapters: { chapterNo: number; isVip: boolean }[] }) => volume.chapters)
        .find((chapter: { isVip: boolean }) => chapter.isVip);
      expect(vipChapter).toBeTruthy();
      state.vipChapterNo = String(vipChapter.chapterNo);

      const response = await http
        .get(`/api/v1/public/sites/books/novels/xinghai-bian/chapters/${vipChapter.chapterNo}`)
        .expect(200);
      const chapter = body(response);
      expect(chapter.locked).toBe(true);
      expect(chapter.content).toBe('');
      expect(chapter.preview.length).toBeGreaterThan(0);
    });
  });

  describe('会员钱包 / 充值 / 解锁 / 书架', () => {
    it('注册会员并获取空钱包', async () => {
      const register = await http
        .post('/api/v1/public/sites/books/members/register')
        .send({
          username: memberUsername,
          email: `${memberUsername}@example.com`,
          password: memberPassword,
          nickname: 'E2E 读者',
        })
        .expect(201);
      tokens.member = body(register).token as string;
      state.memberId = (body(register).member?.id ?? '') as string;
      expect(tokens.member).toBeTruthy();

      const wallet = await http
        .get('/api/v1/public/sites/books/members/wallet')
        .set(member())
        .expect(200);
      expect(body(wallet).balance).toBe(0);
    });

    it('创建订单 → 模拟支付 → 余额到账', async () => {
      const order = await http
        .post('/api/v1/public/sites/books/members/orders')
        .set(member())
        .send({ planId: 'plan-600' })
        .expect(201);
      const orderNo = body(order).orderNo as string;
      expect(body(order).status).toBe('pending');

      const paid = await http
        .post(`/api/v1/public/sites/books/members/orders/${orderNo}/pay`)
        .set(member())
        .expect(201);
      expect(body(paid).balance).toBeGreaterThanOrEqual(600);

      const transactions = await http
        .get('/api/v1/public/sites/books/members/transactions')
        .set(member())
        .expect(200);
      expect(body(transactions).total).toBeGreaterThanOrEqual(1);
    });

    it('解锁 VIP 章节后阅读完整正文', async () => {
      const detail = await http
        .get('/api/v1/public/sites/books/novels/xinghai-bian')
        .expect(200);
      const vipChapter = body(detail).volumes
        .flatMap((volume: { chapters: { id: string; chapterNo: number; isVip: boolean }[] }) => volume.chapters)
        .find((chapter: { isVip: boolean }) => chapter.isVip);
      state.vipChapterId = vipChapter.id;

      const unlock = await http
        .post(`/api/v1/public/sites/books/members/chapters/${vipChapter.id}/unlock`)
        .set(member())
        .expect(201);
      expect(body(unlock).unlocked).toBe(true);
      expect(body(unlock).balance).toBeGreaterThanOrEqual(0);

      const chapter = await http
        .get(`/api/v1/public/sites/books/novels/xinghai-bian/chapters/${vipChapter.chapterNo}`)
        .set(member())
        .expect(200);
      expect(body(chapter).locked).toBe(false);
      expect(body(chapter).content.length).toBeGreaterThan(300);
    });

    it('书架增删与阅读进度', async () => {
      await http
        .post('/api/v1/public/sites/books/members/bookshelf')
        .set(member())
        .send({ novelId: state.novelId })
        .expect(201);
      const shelf = await http
        .get('/api/v1/public/sites/books/members/bookshelf')
        .set(member())
        .expect(200);
      expect(JSON.stringify(body(shelf))).toContain('星海彼岸');

      await http
        .put('/api/v1/public/sites/books/members/progress')
        .set(member())
        .send({ novelId: state.novelId, chapterId: state.vipChapterId, percent: 0.5 })
        .expect(200);
      const history = await http
        .get('/api/v1/public/sites/books/members/history')
        .set(member())
        .expect(200);
      expect(body(history).total).toBeGreaterThanOrEqual(1);

      await http
        .delete(`/api/v1/public/sites/books/members/bookshelf/${state.novelId}`)
        .set(member())
        .expect(200);
    });
  });

  describe('书评与审核', () => {
    it('匿名发表书评（待审核）→ 管理员审核通过 → 门户可见', async () => {
      const created = await http
        .post('/api/v1/public/sites/books/novel-comments')
        .send({ novelId: state.novelId, content: 'E2E 书评：这本书的设定很有意思，期待后续。', nickname: 'E2E 路人' })
        .expect(201);
      const commentId = body(created).id as string;
      expect(body(created).status).toBe('pending');

      const pending = await http
        .get('/api/v1/novel-comments')
        .query({ status: 'pending', novelId: state.novelId })
        .set(admin())
        .set(site('books'))
        .expect(200);
      expect(body(pending).items.length).toBeGreaterThanOrEqual(1);

      await http
        .patch(`/api/v1/novel-comments/${commentId}/status`)
        .set(admin())
        .set(site('books'))
        .send({ status: 'approved' })
        .expect(200);

      const publicComments = await http
        .get('/api/v1/public/sites/books/novel-comments')
        .query({ novelId: state.novelId })
        .expect(200);
      expect(JSON.stringify(body(publicComments))).toContain('E2E 书评');
    });
  });

  describe('作者中心', () => {
    it('会员申请作者 → 管理员通过 → 创建作品与章节 → 上架后门户可见', async () => {
      const penName = `E2E 笔名${Date.now().toString(36).slice(-4)}`;
      const apply = await http
        .post('/api/v1/public/sites/books/members/author')
        .set(member())
        .send({ penName, bio: 'E2E 作者简介', contact: 'e2e@example.com' })
        .expect(201);
      expect(body(apply).status).toBe('pending');
      state.authorProfileId = body(apply).id;

      const applications = await http
        .get('/api/v1/author-applications')
        .query({ status: 'pending', page: 1, pageSize: 20 })
        .set(admin())
        .set(site('books'))
        .expect(200);
      const target = body(applications).items.find(
        (item: { id: string }) => item.id === state.authorProfileId,
      );
      expect(target).toBeTruthy();
      await http
        .post(`/api/v1/author-applications/${state.authorProfileId}/review`)
        .set(admin())
        .set(site('books'))
        .send({ status: 'approved' })
        .expect(201);

      const createNovel = await http
        .post('/api/v1/public/sites/books/members/author/novels')
        .set(member())
        .send({
          title: `E2E 作者新书${Date.now().toString(36).slice(-4)}`,
          summary: '这是 E2E 作者创建的测试作品简介，用于验证作者中心与审核链路。',
          status: 'serial',
        })
        .expect(201);
      const novelId = body(createNovel).id as string;
      state.authorNovelId = novelId;
      expect(body(createNovel).auditStatus).toBe('pending');

      await http
        .post(`/api/v1/novels/${novelId}/review`)
        .set(admin())
        .set(site('books'))
        .send({ auditStatus: 'published' })
        .expect(201);

      await http
        .post(`/api/v1/public/sites/books/members/author/novels/${novelId}/chapters`)
        .set(member())
        .send({
          title: '第1章 测试章节',
          content: '这是作者中心创建的章节正文。'.repeat(20),
          status: 'published',
        })
        .expect(201);

      const detail = await http
        .get(`/api/v1/public/sites/books/novels/${body(createNovel).slug}`)
        .expect(200);
      expect(body(detail).chapterCount).toBeGreaterThanOrEqual(1);

      const stats = await http
        .get('/api/v1/public/sites/books/members/author/stats')
        .set(member())
        .expect(200);
      expect(body(stats).novelCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('管理端：TXT 导入 / 采集 / VIP / 仪表盘', () => {
    it('创建书籍并 TXT 批量导入章节', async () => {
      const categories = await http
        .get('/api/v1/categories')
        .query({ type: 'novel' })
        .set(admin())
        .set(site('books'))
        .expect(200);
      const categoryId = body(categories)[0]?.id;

      const createNovel = await http
        .post('/api/v1/novels')
        .set(admin())
        .set(site('books'))
        .send({
          title: 'E2E TXT 导入书籍',
          authorName: 'E2E 测试作者',
          summary: '用于验证 TXT 批量导入的测试书籍。',
          categoryId,
          status: 'serial',
        })
        .expect(201);
      const novelId = body(createNovel).id as string;

      const txt = ['第一章 起点', '正文甲。', '', '第二章 远行', '正文乙。'].join('\n');
      const imported = await http
        .post(`/api/v1/novels/${novelId}/import-txt`)
        .set(admin())
        .set(site('books'))
        .attach('file', Buffer.from(txt, 'utf8'), 'e2e-novel.txt')
        .expect(201);
      expect(body(imported).chapters).toBe(2);

      const chapters = await http
        .get('/api/v1/chapters')
        .query({ novelId, page: 1, pageSize: 10 })
        .set(admin())
        .set(site('books'))
        .expect(200);
      expect(body(chapters).total).toBe(2);
    });

    it('采集中心：创建书源 → 试采集 → 正式采集成功', async () => {
      // 启动一个临时 HTTP fixture，模拟外部书源站点（CI 中无需本机 API 在 4000 端口监听）
      collectFixture = createServer((req, res) => {
        const url = req.url ?? '/';
        res.setHeader('content-type', 'text/html; charset=utf-8');
        if (url.startsWith('/chapter/')) {
          const chapterNo = Number(url.split('/').pop() ?? '1');
          const paragraphs = Array.from({ length: 4 }, (_, index) => {
            return `<p>第${chapterNo}章第${index + 1}段：这是用于端到端采集测试的正文内容，包含足够的字符用于字数统计。</p>`;
          }).join('');
          res.end(
            `<html><body><h1 class="chapter-title">第${chapterNo}章 测试章节</h1>` +
              `<div class="chapter-content">${paragraphs}</div></body></html>`,
          );
          return;
        }
        res.end(
          '<html><body>' +
            '<h1 class="book-title">雾隐山河</h1>' +
            '<span class="book-author">测试作者</span>' +
            `<img class="book-cover" src="${collectBase}/covers/wu-du-lai-xin.svg" />` +
            '<div class="book-summary">一个用于采集演示的故事简介。</div>' +
            '<ul class="chapter-list">' +
            `<li><a href="${collectBase}/chapter/1">第一章 山雨</a></li>` +
            `<li><a href="${collectBase}/chapter/2">第二章 夜行</a></li>` +
            '</ul></body></html>',
        );
      });
      await new Promise<void>((resolve) => {
        collectFixture!.listen(0, '127.0.0.1', () => resolve());
      });
      const address = collectFixture.address();
      if (!address || typeof address === 'string') {
        throw new Error('采集 fixture 启动失败');
      }
      collectBase = `http://127.0.0.1:${address.port}`;

      const source = await http
        .post('/api/v1/book-sources')
        .set(admin())
        .set(site('books'))
        .send({
          name: 'E2E 演示书源',
          type: 'html',
          baseUrl: `${collectBase}/book`,
          selectors: {
            bookTitle: '.book-title',
            bookAuthor: '.book-author',
            bookCover: '.book-cover',
            bookSummary: '.book-summary',
            chapterLinks: '.chapter-list a',
            chapterTitle: '.chapter-title',
            chapterContent: '.chapter-content',
            linkPrefix: collectBase,
          },
          enabled: true,
        })
        .expect(201);
      const sourceId = body(source).id as string;
      expect(sourceId).toBeTruthy();

      const test = await http
        .post(`/api/v1/book-sources/${sourceId}/test`)
        .set(admin())
        .set(site('books'))
        .send({})
        .expect(201);
      expect(body(test).book.title).toContain('雾隐山河');
      expect(body(test).chapters.length).toBeGreaterThanOrEqual(2);

      const run = await http
        .post('/api/v1/collect/run')
        .set(admin())
        .set(site('books'))
        .send({ sourceId })
        .expect(201);
      expect(body(run).succeeded).toBeGreaterThanOrEqual(2);
      state.collectNovelId = body(run).novelId;

      const tasks = await http
        .get('/api/v1/collect/tasks')
        .set(admin())
        .set(site('books'))
        .expect(200);
      expect(body(tasks).total).toBeGreaterThanOrEqual(1);
    });

    it('VIP 管理：订单列表与调整书币', async () => {
      const orders = await http
        .get('/api/v1/vip/orders')
        .set(admin())
        .set(site('books'))
        .expect(200);
      expect(body(orders).total).toBeGreaterThanOrEqual(1);

      const memberId = state.memberId;
      if (memberId) {
        const credit = await http
          .post('/api/v1/vip/credit')
          .set(admin())
          .set(site('books'))
          .send({ memberId, amount: 100, remark: 'E2E 补偿' })
          .expect(201);
        expect(body(credit).balance).toBeGreaterThanOrEqual(100);
      }
    });

    it('小说仪表盘返回统计数据与洞察', async () => {
      const response = await http
        .get('/api/v1/dashboard/novel-stats')
        .set(admin())
        .set(site('books'))
        .expect(200);
      const stats = body(response);
      expect(stats.novels.total).toBeGreaterThanOrEqual(4);
      expect(stats.chapters.total).toBeGreaterThan(0);
      expect(Array.isArray(stats.insights)).toBe(true);
    });

    it('审计日志包含小说写操作', async () => {
      const response = await http.get('/api/v1/audit-logs').set(admin()).expect(200);
      const items = body(response).items as { action: string }[];
      expect(items.some((log) => log.action.startsWith('novel.') || log.action.startsWith('chapter.'))).toBe(true);
    });
  });
});
