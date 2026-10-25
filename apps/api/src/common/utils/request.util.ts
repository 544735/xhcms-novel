import type { Request } from 'express';

/**
 * 取客户端 IP。
 *
 * 只读 `req.ip`：Express 已按 `app.set('trust proxy', ...)` 的规则（见 main.ts）
 * 从 X-Forwarded-For 中挑出「最右侧可信代理之前的第一个不可信地址」。
 * 绝不自行解析 XFF —— nginx 的 `$proxy_add_x_forwarded_for` 会保留客户端自带的首段，
 * 谁解析首段谁就被任意伪造。
 */
export function clientIp(req: Request): string | null {
  const value = req.ip || req.socket?.remoteAddress || '';
  return value ? String(value).slice(0, 64) : null;
}

export function userAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 500) : null;
}

export function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}
