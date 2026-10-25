import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

/**
 * e2e 测试环境（PostgreSQL）：
 * - 默认连接本地 `docker-compose.infra.yml` 起的测试库；CI 用 DATABASE_URL/TEST_DATABASE_URL 覆盖；
 * - 每次运行前 `migrate reset` + `db:seed`，保证用例从确定的种子数据开始；
 * - 测试签名密钥每次运行随机生成（仅存活于当前测试进程），仓库中不保存任何固定密钥。
 *
 * 注意：这是破坏性操作（清空数据库），禁止指向生产库。
 */
const apiRoot = join(__dirname, '..');

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://xhcms:xhcms@127.0.0.1:5433/xhcms?schema=public';

if (process.env.NODE_ENV === 'production') {
  throw new Error('拒绝在 NODE_ENV=production 下运行 e2e：测试会重置数据库');
}
if (!/^postgres(ql)?:\/\//.test(testDatabaseUrl)) {
  throw new Error(
    `e2e 需要 PostgreSQL 连接串（当前：${testDatabaseUrl}）。请先执行 docker compose -f docker-compose.infra.yml up -d`,
  );
}

const ephemeral = (label: string): string => randomBytes(48).toString('hex');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET = ephemeral('access');
process.env.JWT_REFRESH_SECRET = ephemeral('refresh');
process.env.JWT_MEMBER_SECRET = ephemeral('member');
process.env.PORT = '0';
process.env.CORS_ORIGINS = 'http://localhost:3000';

const childEnv = { ...process.env, NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl };

// 重建 schema（应用全部迁移，含 pg_trgm / 部分唯一索引）并写入种子数据
execSync('pnpm exec prisma migrate reset --force --skip-generate --skip-seed', {
  cwd: apiRoot,
  env: childEnv,
  stdio: 'inherit',
});
execSync('pnpm exec prisma db seed', { cwd: apiRoot, env: childEnv, stdio: 'inherit' });
