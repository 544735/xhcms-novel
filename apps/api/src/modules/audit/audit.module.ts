import { Global, Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { AuditController } from './audit.controller';

/**
 * 全局审计模块：任何业务模块可直接注入 AuditService。
 * 查询接口（AuditController）注册在本模块；providers/exports 保持不变。
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
