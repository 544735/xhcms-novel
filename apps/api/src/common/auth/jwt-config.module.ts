import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { AuthContextService } from './auth-context.service';

const logger = new Logger('JwtConfig');

/**
 * 密钥安全策略（服务端签发/校验用）：
 * - 生产环境必须通过环境变量显式配置，缺失时拒绝启动；
 * - 开发/测试环境未配置时生成进程内随机密钥（进程重启后令牌失效），
 *   从而保证仓库中不存在任何固定密钥。
 * - 随机密钥按环境变量名做进程级 memo，保证 JwtModule 与各守卫拿到同一份密钥。
 */
const generatedSecrets = new Map<string, string>();

export function resolveSecret(config: ConfigService, envKey: string, label: string): string {
  const provided = config.get<string>(envKey);
  if (provided && provided.trim().length >= 16) {
    return provided.trim();
  }
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error(`缺少必需的环境变量 ${envKey}，生产环境必须显式配置签名密钥`);
  }
  const cached = generatedSecrets.get(envKey);
  if (cached) return cached;
  const next = randomBytes(48).toString('hex');
  generatedSecrets.set(envKey, next);
  logger.warn(`${envKey} 未配置，开发环境已生成临时随机密钥（${label}），进程重启后旧令牌失效`);
  return next;
}

export interface JwtSecrets {
  /** 管理端访问令牌签名密钥 */
  access: string;
  /** 管理端刷新令牌签名密钥 */
  refresh: string;
  /** 门户会员令牌签名密钥 */
  member: string;
}

/** 通过 DI 注入的 JWT 密钥集合（Symbol token，避免字符串字面量混淆） */
export const JWT_SECRETS: unique symbol = Symbol('wmcms.jwt.secrets');

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveSecret(config, 'JWT_SECRET', 'access'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [
    {
      provide: JWT_SECRETS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtSecrets => ({
        access: resolveSecret(config, 'JWT_SECRET', 'access'),
        refresh: resolveSecret(config, 'JWT_REFRESH_SECRET', 'refresh'),
        member: resolveSecret(config, 'JWT_MEMBER_SECRET', 'member'),
      }),
    },
    AuthContextService,
  ],
  exports: [JwtModule, JWT_SECRETS, AuthContextService],
})
export class JwtConfigModule {}
