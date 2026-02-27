import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { AuditLogsService } from './audit-logs.service';

@Controller('api/v1/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Roles('pm', 'lead')
  @Get()
  list(@Query('projectId') projectId?: string) {
    return this.auditLogsService.list(projectId ? Number(projectId) : undefined);
  }

  @Roles('pm', 'lead')
  @Get('chatbot')
  listChatbot(@Query('projectId') projectId?: string) {
    return this.auditLogsService.listChatbot(projectId ? Number(projectId) : undefined);
  }
}
