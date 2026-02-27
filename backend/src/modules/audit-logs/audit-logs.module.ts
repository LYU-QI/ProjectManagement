import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

@Module({
  imports: [AccessModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService]
})
export class AuditLogsModule {}
