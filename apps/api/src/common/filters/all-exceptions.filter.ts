import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

interface ErrorBody {
  code: number;
  message: string;
  errors?: string[];
  requestId: string;
  path: string;
  timestamp: string;
}

const PRISMA_MESSAGES: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: '数据已存在，请检查唯一字段（如 slug、用户名、邮箱）' },
  P2003: { status: HttpStatus.BAD_REQUEST, message: '存在关联数据，操作被拒绝' },
  P2025: { status: HttpStatus.NOT_FOUND, message: '目标数据不存在或已被删除' },
  P2011: { status: HttpStatus.BAD_REQUEST, message: '必填字段不能为空' },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const headerRequestId = req.headers['x-request-id'];
    const requestId = (Array.isArray(headerRequestId) ? headerRequestId[0] : headerRequestId) || randomUUID();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误，请稍后重试';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const payload = body as { message?: string | string[]; error?: string };
        if (Array.isArray(payload.message)) {
          message = '请求参数校验失败';
          errors = payload.message;
        } else if (payload.message) {
          message = payload.message;
        } else if (payload.error) {
          message = payload.error;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_MESSAGES[exception.code];
      status = mapped?.status ?? HttpStatus.BAD_REQUEST;
      message = mapped?.message ?? '数据库操作失败';
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = '数据库参数校验失败';
    }

    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      if (isProd) {
        message = '服务器内部错误，请稍后重试';
      } else if (exception instanceof Error && !(exception instanceof HttpException)) {
        message = `内部错误：${exception.message}`;
      }
    } else if (status >= 400) {
      this.logger.warn(`[${requestId}] ${req.method} ${req.url} -> ${status} ${message}`);
    }

    const body: ErrorBody = {
      code: status,
      message,
      requestId,
      path: req.originalUrl || req.url,
      timestamp: new Date().toISOString(),
    };
    if (errors?.length) body.errors = errors;

    if (res.headersSent) return;
    res.status(status).json(body);
  }
}
