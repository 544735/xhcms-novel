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

/**
 * 操作日志（审计）。写日志失败不应影响主流程，因此内部吞掉异常并告警。
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(req: AuthenticatedRequest | undefined, entry: AuditEntry): Promise<void> {
    try {
      const detail =
        entry.detail === undefined
          ? null
          : typeof entry.detail === 'string'
            ? entry.detail
            : JSON.stringify(entry.detail).slice(0, 4000);
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
