import { Global, Module } from '@nestjs/common';
import { AuditLogWriterService } from './audit-log-writer.service';

@Global()
@Module({
  providers: [AuditLogWriterService],
  exports: [AuditLogWriterService]
})
export class AuditModule {}
