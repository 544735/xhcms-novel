import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { map, type Observable } from 'rxjs';
import type { Request } from 'express';
import { IS_RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(IS_RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const headerRequestId = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(headerRequestId) ? headerRequestId[0] : headerRequestId) || randomUUID();

    return next.handle().pipe(
      map((data: unknown) => ({
        code: 0,
        message: 'ok',
        data: data === undefined ? null : data,
        requestId,
      })),
    );
  }
}
