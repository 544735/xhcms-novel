import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { clientIp, userAgent } from '../utils/request.util';
import type { AuthenticatedRequest } from '../types';

export interface AuditEntry {
  action: string;
  resource: string;
  resourceId?: string | null;
  detail?: unknown;
}

/** detail 入库长度上限；超长时改为合法 JSON 的截断信封，绝不硬切出半截 JSON */
const DETAIL_MAX_CHARS = 4000;
const DETAIL_PREVIEW_CHARS = 2000;

function serializeDetail(detail: unknown): string | null {
  if (detail === undefined) return null;
  if (typeof detail === 'string') {
    return detail.length > DETAIL_MAX_CHARS ? detail.slice(0, DETAIL_MAX_CHARS) : detail;
  }
  let json: string;
  try {
    json = JSON.stringify(detail) ?? 'null';
  } catch {
    // 循环引用等无法序列化的情况：丢弃 detail，不阻塞审计写入
    return null;
  }
  if (json.length <= DETAIL_MAX_CHARS) return json;
  return JSON.stringify({ truncated: true, preview: json.slice(0, DETAIL_PREVIEW_CHARS) });
}

/**
 * 操作日志（审计）。写日志失败不应影响主流程，因此内部吞掉异常并告警。
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(req: AuthenticatedRequest | undefined, entry: AuditEntry): Promise<void> {
    try {
      const detail = serializeDetail(entry.detail);
      await this.prisma.auditLog.create({
        data: {
          userId: req?.authContext?.id ?? null,
          username: req?.authContext?.username ?? null,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId ?? null,
          detail,
          ip: req ? clientIp(req) : null,
          userAgent: req ? userAgent(req) : null,
        },
      });
    } catch (error) {
      this.logger.warn(`写操作日志失败: ${(error as Error).message}`);
    }
  }
}
