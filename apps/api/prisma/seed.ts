/**
 * XHCMS Novel 种子数据
 *
 * 生成双站点小说站演示数据：分类、作者、书籍、分卷、章节（含 VIP）、会员钱包/订单/解锁、
 * 书架/阅读进度、书评章评、采集书源、主题、插件、管理员与站点设置。
 *
 * 运行：pnpm --filter @wmcms/api db:seed
 */
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_PERMISSIONS,
  BUILTIN_PLUGINS,
  CHAPTER_DEFAULT_PRICE,
  RECHARGE_PLANS,
  ROLE_PRESETS,
  THEMES,
} from '@wmcms/shared';

const prisma = new PrismaClient();

/**
 * 生产环境不允许回落到仓库里的演示口令：未显式提供 SEED_*_PASSWORD 时随机生成，
 * 并写入凭据文件，供运维首次登录后立即修改。
 * 开发/测试环境保留固定默认值——本地演示与 e2e 依赖它。
 */
const IS_PROD = process.env.NODE_ENV === 'production';

/** 本次实际由随机生成（而非环境变量提供）的口令键 */
const GENERATED_PASSWORD_KEYS = new Set<string>();

/** 凭据文件：默认 apps/api/.seed-credentials.txt；可用 SEED_CREDENTIALS_FILE 覆盖（容器内建议指向 /data） */
const CREDENTIALS_FILE =
  process.env.SEED_CREDENTIALS_FILE ?? join(__dirname, '..', '.seed-credentials.txt');

function resolveSeedPassword(envKey: string, devFallback: string): string {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  if (!IS_PROD) return devFallback;
  GENERATED_PASSWORD_KEYS.add(envKey);
  return randomBytes(12).toString('base64url');
}

const ADMIN_PASSWORD = resolveSeedPassword('SEED_ADMIN_PASSWORD', 'Admin@123456');
const EDITOR_PASSWORD = resolveSeedPassword('SEED_EDITOR_PASSWORD', 'Editor@123456');
const OPERATOR_PASSWORD = resolveSeedPassword('SEED_OPERATOR_PASSWORD', 'Operator@123456');
const MEMBER_PASSWORD = resolveSeedPassword('SEED_MEMBER_PASSWORD', 'Member@123456');

const ACCOUNT_PASSWORD_LABELS: Record<string, string> = {
  SEED_ADMIN_PASSWORD: '超级管理员 admin',
  SEED_EDITOR_PASSWORD: '内容编辑 editor',
  SEED_OPERATOR_PASSWORD: '运营专员 operator',
  SEED_MEMBER_PASSWORD: '读者与作者（alice / bob / carol / xinghe / moxiang / newauthor）',
};

/**
 * 生产环境把随机生成的口令落盘（已存在则不覆盖：运维可能已保存或已改过口令）。
 * 在写库之前调用，避免 seed 中途失败后拿不到初始口令。
 */
function persistGeneratedCredentials(): string | null {
  if (!IS_PROD || GENERATED_PASSWORD_KEYS.size === 0) return null;
  if (existsSync(CREDENTIALS_FILE)) {
    console.log(`🔑 凭据文件已存在，未覆盖：${CREDENTIALS_FILE}（如需重新生成口令请先删除该文件）`);
    return CREDENTIALS_FILE;
  }
  const passwords: Record<string, string> = {
    SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
    SEED_EDITOR_PASSWORD: EDITOR_PASSWORD,
    SEED_OPERATOR_PASSWORD: OPERATOR_PASSWORD,
    SEED_MEMBER_PASSWORD: MEMBER_PASSWORD,
  };
  const lines = [
    '# XHCMS Novel 初始账号凭据（NODE_ENV=production 首次 seed 随机生成）',
    `# 生成时间：${new Date().toISOString()}`,
    '# 请立即登录后台修改这些口令，然后删除本文件；切勿提交到版本库。',
    '',
  ];
  for (const [key, label] of Object.entries(ACCOUNT_PASSWORD_LABELS)) {
    if (!GENERATED_PASSWORD_KEYS.has(key)) continue;
    lines.push(`${label}：${passwords[key]}`);
  }
  lines.push('');
  writeFileSync(CREDENTIALS_FILE, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
  console.log(`🔑 初始口令已写入凭据文件：${CREDENTIALS_FILE}`);
  return CREDENTIALS_FILE;
}

const json = (value: unknown): string => JSON.stringify(value);
const daysAgo = (days: number, hour = 10): Date => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 30, 0, 0);
  return d;
};
const minutesAgo = (minutes: number): Date => new Date(Date.now() - minutes * 60_000);

/** 稳定随机（同一输入产生同一结果，保证种子可复现） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const latin = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return cjk + latin;
}

/* ------------------------------------------------------------------ */
/* 章节正文生成（原创演示文本，避免版权问题）                            */
/* ------------------------------------------------------------------ */

const OPENINGS = [
  '夜色像一块浸了水的墨，缓慢地洇过整座城。',
  '风从山口翻过来时，带着雪粒与松脂的味道。',
  '雨停了，屋檐还在滴水，一滴一滴敲在青石板上。',
  '灯芯爆了一下，火光在墙上晃出细长的影子。',
  '远处传来钟声，一下，又一下，像是有人在数着什么。',
  '海面很平，平得让人心里发慌。',
  '他推开门时，屋里的炭火已经快要熄了。',
  '晨雾还没有散，街道像一条没有尽头的灰白色带子。',
];

const ACTIONS = [
  '沈砚把那封信折成很小的一块，塞进袖口最里层，然后若无其事地端起茶碗。',
  '林晚把伞收起来，靠着墙站了一会儿，才慢慢走进那间铺子。',
  '老人没有回头，只是抬手往炉子里添了一块炭，火苗腾地窜高。',
  '苏澈翻开账册，指尖停在一行被墨涂掉的字上，停了很久。',
  '她沿着河岸走了半里路，忽然停下，回头看那盏还亮着的灯。',
  '门外的人又敲了三下，不急不缓，像早就知道里面有人。',
  '阿九把刀横在膝上，闭着眼，呼吸却一直没匀下来。',
  '柜台后的掌柜抬眼看了他一眼，报出一个不大不小的数目。',
];

const DIALOGUES = [
  '“你确定要走这一步？”他问。',
  '“这不是我想要的答案。”她说得很轻，却不容置疑。',
  '“有些债，躲是躲不掉的。”老人叹了口气。',
  '“如果我说，我早就知道了呢？”少年抬起头。',
  '“天亮之前，必须离开这里。”',
  '“别回头。”他说，“无论听到什么。”',
  '“你欠我的，不是一句谢谢。”',
  '“这一局，还没结束。”',
];

const DESCRIPTIONS = [
  '屋外的风穿过廊下，把灯笼吹得摇摇晃晃，光影在彼此脸上来回移动。',
  '远处的山脊被云压着，只露出一点模糊的轮廓，像沉睡的兽。',
  '茶已经凉了，浮着一层细小的沫，谁也没有去碰。',
  '街上的人渐渐少了，只剩几个挑担的影子，贴着墙根走。',
  '空气里有铁锈的味道，混着雨后泥土的腥气。',
  '时间在这样的沉默里显得很长，长到可以听见自己的心跳。',
  '窗棂上的纸被风顶起一角，又缓缓落下。',
  '远处的河面亮起来，先是几点碎光，然后连成一片。',
];

const CLOSINGS = [
  '他忽然明白，这件事从一开始就没有退路。',
  '她没有再说话，只是把灯推远了一些。',
  '门在身后合上，一切声音都被关在了外面。',
  '天边泛起一线白，像是有人终于松开了手。',
  '这一夜过去之后，很多事都将不同。',
  '他记住了那个人的眼神，连同那半句话。',
];

function buildChapterContent(seedKey: string, chapterNo: number): string {
  const random = mulberry32(hashText(`${seedKey}-${chapterNo}`));
  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)];
  const paragraphs: string[] = [pick(OPENINGS)];

  const paragraphCount = 8 + Math.floor(random() * 4);
  for (let i = 0; i < paragraphCount; i += 1) {
    const sentences = [pick(ACTIONS), pick(DESCRIPTIONS)];
    if (random() > 0.45) sentences.push(pick(DIALOGUES));
    if (random() > 0.6) sentences.push(pick(ACTIONS));
    paragraphs.push(sentences.join(''));
  }
  paragraphs.push(pick(CLOSINGS));
  return paragraphs.join('\n\n');
}

/* ------------------------------------------------------------------ */
/* 小说种子定义                                                        */
/* ------------------------------------------------------------------ */

interface NovelSeed {
  siteSlug: 'books' | 'ink';
  slug: string;
  title: string;
  authorName: string;
  authorMember?: 'xinghe' | 'moxiang';
  categorySlug: string;
  status: 'serial' | 'completed';
  auditStatus?: 'published' | 'pending';
  summary: string;
  isRecommend?: boolean;
  isTop?: boolean;
  views: number;
  favorites: number;
  vipFrom?: number;
  chapterCount?: number;
  days: number;
}

const NOVEL_SEEDS: NovelSeed[] = [
  {
    siteSlug: 'books',
    slug: 'xinghai-bian',
    title: '星海彼岸',
    authorName: '星河散人',
    authorMember: 'xinghe',
    categorySlug: 'sci-fi',
    status: 'serial',
    summary:
      '第七舰队的最后一名领航员在废弃星港醒来，记忆里只剩下一串坐标。当他沿着坐标抵达星海尽头，才发现那里等着的，是整个人类文明最不愿提起的往事。',
    isRecommend: true,
    isTop: true,
    views: 128_640,
    favorites: 9_820,
    vipFrom: 5,
    days: 3,
  },
  {
    siteSlug: 'books',
    slug: 'chang-ye-xing',
    title: '长夜行',
    authorName: '星河散人',
    authorMember: 'xinghe',
    categorySlug: 'xuanhuan',
    status: 'serial',
    summary:
      '北境有个规矩：过了子时，不要看雪地里的脚印。少年背着半截断刀走进长夜，他要找的人，已经在雪里走了七年。',
    isRecommend: true,
    views: 96_200,
    favorites: 7_430,
    vipFrom: 4,
    days: 5,
  },
  {
    siteSlug: 'books',
    slug: 'du-shi-shou-ye-ren',
    title: '都市守夜人',
    authorName: '夜航灯',
    categorySlug: 'urban',
    status: 'serial',
    summary:
      '白天他是旧城区一间修表铺的老板，夜里他替这座城处理那些“不能被记录”的事。直到某天，一个女孩拿着一块停摆二十年的表找上门。',
    views: 74_310,
    favorites: 5_180,
    vipFrom: 3,
    days: 8,
  },
  {
    siteSlug: 'books',
    slug: 'da-yong-feng-yun',
    title: '大雍风云',
    authorName: '青史拾遗',
    categorySlug: 'history',
    status: 'completed',
    summary:
      '大雍三十七年，一场春闱牵出旧案。寒门举子、落难皇孙与一位不肯低头的女官，在朝堂与江湖之间各自落子。',
    isRecommend: true,
    views: 152_900,
    favorites: 12_400,
    vipFrom: 6,
    days: 12,
  },
  {
    siteSlug: 'ink',
    slug: 'chun-shen-bu-zhi-chu',
    title: '春深不知处',
    authorName: '墨香公子',
    authorMember: 'moxiang',
    categorySlug: 'ancient-romance',
    status: 'serial',
    summary:
      '沈家三姑娘被退婚那日，京城下了很大的雪。她烧掉嫁衣，只带走了母亲留下的一只旧木匣。三年后，所有人都想知道匣子里装着什么。',
    isRecommend: true,
    isTop: true,
    views: 210_500,
    favorites: 18_760,
    vipFrom: 4,
    days: 2,
  },
  {
    siteSlug: 'ink',
    slug: 'ni-shi-wo-de-xing-he',
    title: '你是我的星河',
    authorName: '墨香公子',
    authorMember: 'moxiang',
    categorySlug: 'modern-romance',
    status: 'completed',
    summary:
      '航天工程师与纪录片导演在一次发射任务中重逢。七年前的误会没有解释，七年后他们只能隔着指挥大厅的玻璃，把所有话都咽回去。',
    views: 176_300,
    favorites: 15_900,
    vipFrom: 5,
    days: 20,
  },
  {
    siteSlug: 'ink',
    slug: 'wu-du-lai-xin',
    title: '雾都来信',
    authorName: '南屿',
    categorySlug: 'fantasy',
    status: 'serial',
    auditStatus: 'pending',
    summary:
      '一封寄自雾都的信，收信人却已去世十年。少女沿着信里的地址找过去，发现整座城市都在等这封信。',
    views: 3_200,
    favorites: 260,
    days: 1,
  },
];

const CHAPTER_TITLES = [
  '风起',
  '旧信',
  '来客',
  '灯下',
  '雪落',
  '暗涌',
  '长街',
  '夜航',
  '归途',
  '破晓',
  '故人',
  '余烬',
];

const CATEGORY_SEEDS: Record<'books' | 'ink', { name: string; slug: string; icon: string }[]> = {
  books: [
    { name: '玄幻', slug: 'xuanhuan', icon: 'Swords' },
    { name: '都市', slug: 'urban', icon: 'Building2' },
    { name: '科幻', slug: 'sci-fi', icon: 'Rocket' },
    { name: '历史', slug: 'history', icon: 'Landmark' },
    { name: '悬疑', slug: 'suspense', icon: 'Search' },
    { name: '游戏', slug: 'game', icon: 'Gamepad2' },
  ],
  ink: [
    { name: '古言', slug: 'ancient-romance', icon: 'ScrollText' },
    { name: '现言', slug: 'modern-romance', icon: 'Heart' },
    { name: '幻想', slug: 'fantasy', icon: 'Sparkles' },
    { name: '青春', slug: 'youth', icon: 'Sunrise' },
    { name: '悬疑', slug: 'suspense', icon: 'Search' },
  ],
};

async function main(): Promise<void> {
  console.log('\n🌱 初始化 XHCMS 小说站演示数据 …\n');

  // 生产环境口令是随机生成的：先落盘再写库，避免 seed 中途失败后拿不到初始口令
  const credentialsFile = persistGeneratedCredentials();

  // ---------- 清理（按依赖顺序） ----------
  await prisma.auditLog.deleteMany();
  await prisma.chapterUnlock.deleteMany();
  await prisma.coinTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.readingProgress.deleteMany();
  await prisma.bookshelf.deleteMany();
  await prisma.novelComment.deleteMany();
  await prisma.collectTask.deleteMany();
  await prisma.bookSource.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.volume.deleteMany();
  await prisma.novel.deleteMany();
  await prisma.authorProfile.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.formSubmission.deleteMany();
  await prisma.form.deleteMany();
  await prisma.articleTag.deleteMany();
  await prisma.article.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.media.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.member.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.userSite.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.plugin.deleteMany();
  await prisma.theme.deleteMany();
  await prisma.user.deleteMany();
  await prisma.site.deleteMany();

  // ---------- 权限 / 角色 ----------
  await prisma.permission.createMany({
    data: ALL_PERMISSIONS.map((p) => ({ code: p.code, name: p.name, group: p.group })),
  });
  const permissionRows = await prisma.permission.findMany();
  const permissionIdByCode = new Map(permissionRows.map((p) => [p.code, p.id]));

  const roles: Record<string, { id: string }> = {};
  for (const [code, preset] of Object.entries(ROLE_PRESETS)) {
    const role = await prisma.role.create({
      data: {
        code,
        name: preset.name,
        description: preset.description,
        isSystem: true,
        permissions: {
          create: preset.permissions
            .map((permissionCode) => permissionIdByCode.get(permissionCode))
            .filter((id): id is string => Boolean(id))
            .map((permissionId) => ({ permissionId })),
        },
      },
    });
    roles[code] = role;
  }
  console.log(`✅ 权限 ${permissionRows.length} 项 / 角色 ${Object.keys(roles).length} 个`);

  // ---------- 站点 ----------
  const siteBooks = await prisma.site.create({
    data: {
      name: '星海书城',
      slug: 'books',
      domain: 'books.localhost',
      themeKey: 'modern',
      description: '星海书城 · 玄幻、科幻、都市与历史，好故事都在这里。',
      seoTitle: '星海书城 · 在线小说阅读',
      seoKeywords: '小说,玄幻,科幻,都市,历史,在线阅读',
      seoDescription: '星海书城：提供玄幻、科幻、都市、历史等原创小说在线阅读与书架收藏。',
      settings: json({
        primaryColor: '#6366f1',
        icp: '京ICP备2026000001号',
        copyright: '© 2026 星海书城 · XHCMS Novel',
        pageSize: 12,
        commentAudit: true,
        heroTitle: '在星海之下，读一个好故事',
        heroSubtitle: '玄幻 · 科幻 · 都市 · 历史 · 每日更新',
      }),
    },
  });
  const siteInk = await prisma.site.create({
    data: {
      name: '墨香书屋',
      slug: 'ink',
      domain: 'ink.localhost',
      themeKey: 'magazine',
      description: '墨香书屋 · 古言、现言与幻想，写给喜欢慢读的你。',
      seoTitle: '墨香书屋 · 言情小说阅读',
      seoKeywords: '言情,古言,现言,幻想,在线阅读',
      seoDescription: '墨香书屋：古言、现言、幻想与青春题材小说在线阅读。',
      settings: json({
        primaryColor: '#b45309',
        icp: '京ICP备2026000002号',
        copyright: '© 2026 墨香书屋 · XHCMS Novel',
        pageSize: 12,
        commentAudit: true,
        heroTitle: '慢一点，读一段好故事',
        heroSubtitle: '古言 · 现言 · 幻想 · 青春',
      }),
    },
  });
  const sitesBySlug = { books: siteBooks, ink: siteInk } as const;
  console.log(`✅ 站点：${siteBooks.name}(books) / ${siteInk.name}(ink)`);

  // ---------- 主题 / 插件 ----------
  await prisma.theme.createMany({
    data: THEMES.map((theme, index) => ({
      key: theme.key,
      name: theme.name,
      description: theme.description,
      preview: theme.preview,
      builtin: true,
      config: json(theme.config),
      sort: index,
    })),
  });
  await prisma.plugin.createMany({
    data: BUILTIN_PLUGINS.map((plugin) => ({
      key: plugin.key,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      enabled: true,
      builtin: true,
      hooks: json(plugin.hooks),
      config: json(plugin.defaultConfig),
    })),
  });
  console.log(`✅ 主题 ${THEMES.length} 套 / 插件 ${BUILTIN_PLUGINS.length} 个`);

  // ---------- 管理员 ----------
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@wmcms.local',
      password: hashSync(ADMIN_PASSWORD, 10),
      nickname: '超级管理员',
      isSuperAdmin: true,
      roles: { create: [{ roleId: roles.super_admin.id }] },
    },
  });
  await prisma.user.create({
    data: {
      username: 'editor',
      email: 'editor@wmcms.local',
      password: hashSync(EDITOR_PASSWORD, 10),
      nickname: '内容编辑',
      roles: { create: [{ roleId: roles.editor.id }] },
      userSites: { create: [{ siteId: siteBooks.id }, { siteId: siteInk.id }] },
    },
  });
  await prisma.user.create({
    data: {
      username: 'operator',
      email: 'operator@wmcms.local',
      password: hashSync(OPERATOR_PASSWORD, 10),
      nickname: '运营专员',
      roles: { create: [{ roleId: roles.operator.id }] },
      userSites: { create: [{ siteId: siteBooks.id }, { siteId: siteInk.id }] },
    },
  });
  console.log('✅ 管理员：admin / editor / operator');

  // ---------- 分类 ----------
  const categoryBySiteSlug: Record<string, Record<string, { id: string; name: string }>> = {
    books: {},
    ink: {},
  };
  for (const siteSlug of ['books', 'ink'] as const) {
    const site = sitesBySlug[siteSlug];
    for (const [index, category] of CATEGORY_SEEDS[siteSlug].entries()) {
      const created = await prisma.category.create({
        data: {
          siteId: site.id,
          name: category.name,
          slug: category.slug,
          type: 'novel',
          icon: category.icon,
          sort: index + 1,
          status: 'enabled',
        },
      });
      categoryBySiteSlug[siteSlug][category.slug] = { id: created.id, name: created.name };
    }
  }
  console.log('✅ 分类：星海书城 6 类 / 墨香书屋 5 类');

  // ---------- 会员（含作者） ----------
  interface MemberSeed {
    key: string;
    siteSlug: 'books' | 'ink';
    username: string;
    nickname: string;
    email: string;
    coins: number;
    isAuthor?: { penName: string; bio: string };
  }
  const memberSeeds: MemberSeed[] = [
    { key: 'alice', siteSlug: 'books', username: 'alice', nickname: '爱丽丝', email: 'alice@example.com', coins: 860 },
    { key: 'bob', siteSlug: 'books', username: 'bob', nickname: '鲍勃', email: 'bob@example.com', coins: 120 },
    {
      key: 'xinghe',
      siteSlug: 'books',
      username: 'xinghe',
      nickname: '星河散人',
      email: 'xinghe@example.com',
      coins: 2_400,
      isAuthor: { penName: '星河散人', bio: '写科幻与玄幻，偶尔写诗。代表作《星海彼岸》《长夜行》。' },
    },
    { key: 'carol', siteSlug: 'ink', username: 'carol', nickname: '卡萝', email: 'carol@example.com', coins: 300 },
    {
      key: 'moxiang',
      siteSlug: 'ink',
      username: 'moxiang',
      nickname: '墨香公子',
      email: 'moxiang@example.com',
      coins: 1_800,
      isAuthor: { penName: '墨香公子', bio: '古言与现言作者，喜欢写克制的感情与缓慢的告别。' },
    },
  ];
  const members: Record<string, { id: string; siteId: string; nickname: string }> = {};
  for (const [index, seed] of memberSeeds.entries()) {
    const site = sitesBySlug[seed.siteSlug];
    const member = await prisma.member.create({
      data: {
        siteId: site.id,
        username: seed.username,
        email: seed.email,
        nickname: seed.nickname,
        password: hashSync(MEMBER_PASSWORD, 10),
        status: 'active',
        points: 20 + index * 5,
        lastLoginAt: daysAgo(index % 3),
        wallet: { create: { balance: seed.coins } },
      },
    });
    members[seed.key] = { id: member.id, siteId: site.id, nickname: seed.nickname };
    if (seed.isAuthor) {
      await prisma.authorProfile.create({
        data: {
          memberId: member.id,
          penName: seed.isAuthor.penName,
          bio: seed.isAuthor.bio,
          status: 'approved',
          contact: `${seed.username}@example.com`,
          reviewedAt: daysAgo(30),
        },
      });
    }
  }
  // 一位待审核的作者申请
  await prisma.member.create({
    data: {
      siteId: siteBooks.id,
      username: 'newauthor',
      email: 'newauthor@example.com',
      nickname: '新手作者',
      password: hashSync(MEMBER_PASSWORD, 10),
      authorProfile: {
        create: {
          penName: '初墨',
          bio: '想写一个关于小镇与夏天的故事。',
          status: 'pending',
          contact: 'newauthor@example.com',
        },
      },
      wallet: { create: { balance: 0 } },
    },
  });
  console.log(`✅ 会员 ${memberSeeds.length + 1} 位（含 2 位作者、1 份待审申请）`);

  // ---------- 作者钱包流水（稿费） ----------
  for (const key of ['xinghe', 'moxiang'] as const) {
    const member = members[key];
    await prisma.coinTransaction.create({
      data: {
        memberId: member.id,
        type: 'reward',
        amount: 1_500,
        balance: 1_500,
        remark: '月度稿费结算',
        createdAt: daysAgo(15),
      },
    });
  }

  // ---------- 书籍 / 分卷 / 章节 ----------
  interface CreatedNovel {
    id: string;
    siteId: string;
    siteSlug: 'books' | 'ink';
    slug: string;
    title: string;
    authorName: string;
    categoryId: string;
    categoryName: string;
    chapterIds: string[];
    vipChapterIds: string[];
    firstChapterId: string;
    lastChapterId: string;
  }

  const createdNovels = new Map<string, CreatedNovel>();
  let chapterTotal = 0;

  for (const [index, seed] of NOVEL_SEEDS.entries()) {
    const site = sitesBySlug[seed.siteSlug];
    const category = categoryBySiteSlug[seed.siteSlug][seed.categorySlug];
    const authorId = seed.authorMember ? members[seed.authorMember].id : null;
    const seedRandom = mulberry32(hashText(seed.slug));
    const chapterCount = seed.chapterCount ?? 10;
    const vipFrom = seed.vipFrom ?? 4;

    const novel = await prisma.novel.create({
      data: {
        siteId: site.id,
        categoryId: category.id,
        authorId,
        authorName: seed.authorName,
        title: seed.title,
        slug: seed.slug,
        cover: `/covers/${seed.slug}.svg`,
        summary: seed.summary,
        status: seed.status,
        auditStatus: seed.auditStatus ?? 'published',
        isRecommend: Boolean(seed.isRecommend),
        isTop: Boolean(seed.isTop),
        views: seed.views,
        favorites: seed.favorites,
        vipOnly: false,
        publishedAt: daysAgo(seed.days + 30),
        lastChapterAt: daysAgo(seed.days),
        seoTitle: `${seed.title}最新章节_${seed.authorName}_星海书城`,
        seoKeywords: `${seed.title},${category.name},${seed.authorName},小说`,
        seoDescription: seed.summary.slice(0, 100),
      },
    });

    const volumeTitles = ['第一卷 风起', '第二卷 云涌'];
    const volumes: { id: string }[] = [];
    for (const [volumeIndex, volumeTitle] of volumeTitles.entries()) {
      volumes.push(
        await prisma.volume.create({
          data: { novelId: novel.id, title: volumeTitle, sort: volumeIndex },
        }),
      );
    }

    const chapterIds: string[] = [];
    const vipChapterIds: string[] = [];
    let words = 0;
    for (let n = 1; n <= chapterCount; n += 1) {
      const contentSeed = `${seed.slug}-chapter-content`;
      const content = buildChapterContent(contentSeed, n);
      const wordCount = countWords(content);
      words += wordCount;
      const isVip = n >= vipFrom;
      const chapterTitle = `第${n}章 ${CHAPTER_TITLES[(n - 1) % CHAPTER_TITLES.length]}`;
      const publishedAt = daysAgo(Math.max(0, seed.days - Math.floor(n / 3)), 9 + (n % 8));
      const chapter = await prisma.chapter.create({
        data: {
          novelId: novel.id,
          volumeId: volumes[n <= 5 ? 0 : 1].id,
          chapterNo: n,
          title: chapterTitle,
          content,
          wordCount,
          isVip,
          price: isVip ? CHAPTER_DEFAULT_PRICE : 0,
          status: 'published',
          views: Math.floor(seedRandom() * 4000) + n * 37,
          publishedAt,
        },
      });
      chapterIds.push(chapter.id);
      if (isVip) vipChapterIds.push(chapter.id);
      chapterTotal += 1;
    }

    await prisma.novel.update({
      where: { id: novel.id },
      data: {
        words,
        chapterCount,
        lastChapterAt: daysAgo(seed.days),
      },
    });

    createdNovels.set(seed.slug, {
      id: novel.id,
      siteId: site.id,
      siteSlug: seed.siteSlug,
      slug: seed.slug,
      title: seed.title,
      authorName: seed.authorName,
      categoryId: category.id,
      categoryName: category.name,
      chapterIds,
      vipChapterIds,
      firstChapterId: chapterIds[0],
      lastChapterId: chapterIds[chapterIds.length - 1],
    });

    if (index % 3 === 0) console.log(`   · 已创建《${seed.title}》${chapterCount} 章`);
    if (index === NOVEL_SEEDS.length - 1) {
      // 为第二本待审书籍补一条待审记录（雾都来信已在 seeds 中标记 pending）
    }
  }
  console.log(`✅ 书籍 ${createdNovels.size} 本 / 章节 ${chapterTotal} 章`);

  // ---------- 媒体库（演示封面占位） ----------
  // 上传白名单 UPLOAD_ALLOWED_MIME 只接受位图/PDF（不含 image/svg+xml，SVG 直链可触发存储型 XSS），
  // 而 apps/web/public/covers/ 下只有 .svg 封面，因此这里改用受支持的 image/png 占位 URL：
  // 占位文件不在磁盘上，仅用于后台「媒体库」演示；真实上传会生成 /uploads/<siteId>/<yyyyMM>/<uuid>.png。
  const MEDIA_PLACEHOLDER_URL = '/uploads/demo/demo-cover.png';
  const mediaSeeds = NOVEL_SEEDS.slice(0, 6).map((seed) => ({
    siteId: sitesBySlug[seed.siteSlug].id,
    name: `${seed.slug}.png`,
    url: MEDIA_PLACEHOLDER_URL,
  }));
  for (const [index, item] of mediaSeeds.entries()) {
    await prisma.media.create({
      data: {
        siteId: item.siteId,
        filename: item.name,
        originalName: item.name,
        mimeType: 'image/png',
        size: 1_800 + index * 120,
        width: 1200,
        height: 750,
        url: item.url,
        folder: '2026/10',
        uploadedById: admin.id,
      },
    });
  }
  console.log(`✅ 媒体库：${mediaSeeds.length} 个封面（image/png 演示占位）`);

  // ---------- 充值订单 / 流水 / 解锁 ----------
  const orderSeeds = [
    { member: 'alice', plan: RECHARGE_PLANS[1], days: 6, paid: true },
    { member: 'alice', plan: RECHARGE_PLANS[0], days: 2, paid: true },
    { member: 'carol', plan: RECHARGE_PLANS[0], days: 3, paid: true },
    { member: 'bob', plan: RECHARGE_PLANS[0], days: 1, paid: false },
  ];
  let orderIndex = 0;
  for (const seed of orderSeeds) {
    orderIndex += 1;
    const member = members[seed.member];
    const orderNo = `WM${Date.now().toString(36).toUpperCase()}${String(orderIndex).padStart(3, '0')}`;
    const paidAt = seed.paid ? daysAgo(seed.days, 20) : null;
    await prisma.order.create({
      data: {
        memberId: member.id,
        orderNo,
        amountCents: seed.plan.amountCents,
        coins: seed.plan.coins + (seed.plan.bonusCoins ?? 0),
        status: seed.paid ? 'paid' : 'pending',
        channel: 'mock',
        paidAt,
        createdAt: daysAgo(seed.days, 20),
      },
    });
    if (seed.paid) {
      await prisma.coinTransaction.create({
        data: {
          memberId: member.id,
          type: 'recharge',
          amount: seed.plan.coins + (seed.plan.bonusCoins ?? 0),
          balance: 0, // 历史流水余额占位，真实余额见钱包
          refType: 'order',
          refId: orderNo,
          remark: `充值 ${seed.plan.label}`,
          createdAt: paidAt ?? new Date(),
        },
      });
    }
  }

  const alice = members.alice;
  const carol = members.carol;
  const xinghai = createdNovels.get('xinghai-bian')!;
  const chunshen = createdNovels.get('chun-shen-bu-zhi-chu')!;
  const changye = createdNovels.get('chang-ye-xing')!;
  const shouye = createdNovels.get('du-shi-shou-ye-ren')!;

  const unlockSeeds = [
    { memberId: alice.id, chapterId: xinghai.vipChapterIds[0], coins: CHAPTER_DEFAULT_PRICE },
    { memberId: alice.id, chapterId: xinghai.vipChapterIds[1], coins: CHAPTER_DEFAULT_PRICE },
    { memberId: alice.id, chapterId: changye.vipChapterIds[0], coins: CHAPTER_DEFAULT_PRICE },
    { memberId: carol.id, chapterId: chunshen.vipChapterIds[0], coins: CHAPTER_DEFAULT_PRICE },
  ];
  for (const [index, seed] of unlockSeeds.entries()) {
    await prisma.chapterUnlock.create({
      data: { ...seed, createdAt: daysAgo(index % 4, 21) },
    });
    await prisma.coinTransaction.create({
      data: {
        memberId: seed.memberId,
        type: 'consume',
        amount: -seed.coins,
        balance: 0,
        refType: 'chapter',
        refId: seed.chapterId,
        remark: '解锁付费章节',
        createdAt: daysAgo(index % 4, 21),
      },
    });
  }

  // ---------- 书架 / 阅读进度 ----------
  const shelfSeeds = [
    { memberId: alice.id, novelId: xinghai.id, createdAt: daysAgo(5) },
    { memberId: alice.id, novelId: changye.id, createdAt: daysAgo(4) },
    { memberId: alice.id, novelId: shouye.id, createdAt: daysAgo(2) },
    { memberId: carol.id, novelId: chunshen.id, createdAt: daysAgo(3) },
  ];
  for (const seed of shelfSeeds) {
    await prisma.bookshelf.create({ data: seed });
  }

  const progressSeeds = [
    {
      memberId: alice.id,
      novelId: xinghai.id,
      chapterId: xinghai.chapterIds[4],
      chapterNo: 5,
      percent: 0.62,
      updatedAt: minutesAgo(35),
    },
    {
      memberId: alice.id,
      novelId: changye.id,
      chapterId: changye.chapterIds[2],
      chapterNo: 3,
      percent: 0.28,
      updatedAt: minutesAgo(180),
    },
    {
      memberId: carol.id,
      novelId: chunshen.id,
      chapterId: chunshen.chapterIds[2],
      chapterNo: 3,
      percent: 0.45,
      updatedAt: minutesAgo(90),
    },
  ];
  for (const seed of progressSeeds) {
    await prisma.readingProgress.create({ data: seed });
  }

  // ---------- 书评 / 章评 ----------
  interface CommentSeed {
    novelSlug: string;
    chapterIndex: number | null;
    memberKey?: string;
    nickname: string;
    content: string;
    status: 'approved' | 'pending';
    minutes: number;
  }
  const commentSeeds: CommentSeed[] = [
    { novelSlug: 'xinghai-bian', chapterIndex: null, memberKey: 'alice', nickname: '爱丽丝', content: '设定很扎实，星港那段氛围感太强了，期待后续展开。', status: 'approved', minutes: 120 },
    { novelSlug: 'xinghai-bian', chapterIndex: 2, nickname: '路过的读者', content: '第三章的转折没想到，作者埋线埋得挺深。', status: 'approved', minutes: 240 },
    { novelSlug: 'chang-ye-xing', chapterIndex: null, nickname: '雪夜', content: '“过了子时不要看脚印”这句开场就把我抓住了。', status: 'approved', minutes: 600 },
    { novelSlug: 'chun-shen-bu-zhi-chu', chapterIndex: 1, memberKey: 'carol', nickname: '卡萝', content: '三姑娘烧嫁衣那段写得真好，克制但很有力量。', status: 'approved', minutes: 300 },
    { novelSlug: 'xinghai-bian', chapterIndex: null, nickname: '催更选手', content: '更新太慢了，作者加油！', status: 'pending', minutes: 30 },
    { novelSlug: 'chun-shen-bu-zhi-chu', chapterIndex: null, nickname: '匿名', content: '加微信送全书资源', status: 'pending', minutes: 15 },
  ];
  for (const seed of commentSeeds) {
    const entry = createdNovels.get(seed.novelSlug);
    if (!entry) continue;
    await prisma.novelComment.create({
      data: {
        siteId: entry.siteId,
        novelId: entry.id,
        chapterId: seed.chapterIndex === null ? null : entry.chapterIds[seed.chapterIndex],
        memberId: seed.memberKey ? members[seed.memberKey].id : null,
        nickname: seed.nickname,
        content: seed.content,
        status: seed.status,
        ip: '127.0.0.1',
        createdAt: minutesAgo(seed.minutes),
      },
    });
  }
  console.log(`✅ 书评/章评：${commentSeeds.length} 条（含待审核）`);

  // ---------- 采集书源 ----------
  await prisma.bookSource.createMany({
    data: [
      {
        siteId: siteBooks.id,
        name: '示例 HTML 书源',
        type: 'html',
        baseUrl: 'https://example.com/book/1',
        listUrl: null,
        selectors: json({
          bookTitle: 'h1.book-title',
          bookAuthor: 'span.author',
          bookCover: 'img.cover',
          bookSummary: 'div.intro',
          chapterLinks: 'ul.chapter-list a',
          chapterTitle: 'h1.chapter-title',
          chapterContent: 'div.chapter-content',
        }),
        enabled: false,
      },
      {
        siteId: siteInk.id,
        name: '示例 JSON 书源',
        type: 'json',
        baseUrl: 'https://example.com/api/book/1',
        listUrl: 'https://example.com/api/book/1/chapters',
        selectors: json({
          itemsPath: 'data.chapters',
          titlePath: 'title',
          contentPath: 'content',
        }),
        enabled: false,
      },
    ],
  });
  console.log('✅ 采集书源：2 个（示例，默认停用）');

  // ---------- 站点设置 ----------
  const settings = [
    { siteId: null, key: 'version', value: '2.0.0', group: 'system' },
    { siteId: null, key: 'installedAt', value: new Date().toISOString(), group: 'system' },
    { siteId: siteBooks.id, key: 'title', value: siteBooks.name, group: 'general' },
    { siteId: siteBooks.id, key: 'description', value: siteBooks.description ?? '', group: 'general' },
    { siteId: siteBooks.id, key: 'icp', value: '京ICP备2026000001号', group: 'general' },
    { siteId: siteBooks.id, key: 'copyright', value: '© 2026 星海书城 · XHCMS Novel', group: 'general' },
    { siteId: siteBooks.id, key: 'keywords', value: siteBooks.seoKeywords ?? '', group: 'seo' },
    { siteId: siteBooks.id, key: 'commentAudit', value: 'true', group: 'comment' },
    { siteId: siteBooks.id, key: 'pageSize', value: '12', group: 'home' },
    { siteId: siteBooks.id, key: 'heroTitle', value: '在星海之下，读一个好故事', group: 'home' },
    { siteId: siteBooks.id, key: 'heroSubtitle', value: '玄幻 · 科幻 · 都市 · 历史 · 每日更新', group: 'home' },
    { siteId: siteInk.id, key: 'title', value: siteInk.name, group: 'general' },
    { siteId: siteInk.id, key: 'description', value: siteInk.description ?? '', group: 'general' },
    { siteId: siteInk.id, key: 'icp', value: '京ICP备2026000002号', group: 'general' },
    { siteId: siteInk.id, key: 'copyright', value: '© 2026 墨香书屋 · XHCMS Novel', group: 'general' },
    { siteId: siteInk.id, key: 'keywords', value: siteInk.seoKeywords ?? '', group: 'seo' },
    { siteId: siteInk.id, key: 'commentAudit', value: 'true', group: 'comment' },
    { siteId: siteInk.id, key: 'pageSize', value: '12', group: 'home' },
    { siteId: siteInk.id, key: 'heroTitle', value: '慢一点，读一段好故事', group: 'home' },
    { siteId: siteInk.id, key: 'heroSubtitle', value: '古言 · 现言 · 幻想 · 青春', group: 'home' },
  ];
  await prisma.setting.createMany({ data: settings });

  // ---------- 审计日志 ----------
  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, username: 'admin', action: 'site.create', resource: 'site', resourceId: siteBooks.id, detail: json({ name: siteBooks.name }), ip: '127.0.0.1', createdAt: daysAgo(40) },
      { userId: admin.id, username: 'admin', action: 'novel.create', resource: 'novel', resourceId: xinghai.id, detail: json({ title: xinghai.title }), ip: '127.0.0.1', createdAt: daysAgo(33) },
      { userId: admin.id, username: 'admin', action: 'novel.review', resource: 'novel', resourceId: xinghai.id, detail: json({ auditStatus: 'published' }), ip: '127.0.0.1', createdAt: daysAgo(32) },
      { userId: admin.id, username: 'admin', action: 'chapter.create', resource: 'chapter', resourceId: xinghai.chapterIds[0], detail: json({ chapterNo: 1 }), ip: '127.0.0.1', createdAt: daysAgo(30) },
      { userId: admin.id, username: 'admin', action: 'vip.credit', resource: 'wallet', resourceId: alice.id, detail: json({ amount: 500 }), ip: '127.0.0.1', createdAt: daysAgo(10) },
    ],
  });

  console.log('\n🎉 小说站初始化完成！\n');
  console.log('   门户：http://localhost:3000 （默认 books 站）· http://localhost:3000/ink');
  console.log('   后台：http://localhost:3000/admin');
  if (IS_PROD) {
    // 生产环境不把口令写进日志（docker logs / CI 日志 / 部署日志都可能被更多人看到）
    console.log('   超级管理员：admin（口令未在日志中输出）');
    console.log('   内容编辑：editor ｜ 运营专员：operator ｜ 读者：alice ｜ 作者：xinghe');
    console.log(
      credentialsFile
        ? `   初始口令：见 ${credentialsFile}（请立即登录后台修改，然后删除该文件）`
        : '   初始口令：由 SEED_*_PASSWORD 环境变量提供，未写入磁盘',
    );
  } else {
    console.log(`   超级管理员：admin / ${ADMIN_PASSWORD}`);
    console.log(`   内容编辑：editor / ${EDITOR_PASSWORD}`);
    console.log(`   运营专员：operator / ${OPERATOR_PASSWORD}`);
    console.log(`   读者：alice / ${MEMBER_PASSWORD}（书币 860，含已购章节）`);
    console.log(`   作者：xinghe / ${MEMBER_PASSWORD}（笔名 星河散人）`);
  }
  console.log('\n');
}

main()
  .catch((error) => {
    console.error('❌ 种子数据初始化失败：', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
