import { copyFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

/**
 * e2e 测试环境：复制一份种子数据库作为隔离测试库，避免污染开发数据。
 * Prisma 的相对路径以 schema.prisma 所在目录（prisma/）为基准。
 *
 * 测试签名密钥每次运行随机生成（仅存活于当前测试进程），仓库中不保存任何固定密钥。
 */
const prismaDir = join(__dirname, '..', 'prisma');
const source = join(prismaDir, 'dev.db');
const target = join(prismaDir, 'test.db');

if (!existsSync(source)) {
  throw new Error('未找到 prisma/dev.db，请先执行 pnpm db:push && pnpm db:seed');
}
copyFileSync(source, target);

const ephemeral = (label: string): string => randomBytes(48).toString('hex');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = ephemeral('access');
process.env.JWT_REFRESH_SECRET = ephemeral('refresh');
process.env.JWT_MEMBER_SECRET = ephemeral('member');
process.env.PORT = '0';
process.env.CORS_ORIGINS = 'http://localhost:3000';
