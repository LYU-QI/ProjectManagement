import { Controller, Get, Query, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { AuditLogsService } from './audit-logs.service';

@Controller('api/v1/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Get()
  list(@Query('projectId') projectId?: string, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.auditLogsService.list(req?.user, projectId ? Number(projectId) : undefined);
  }

  @Roles('pm', 'lead', 'project_manager', 'project_director', 'super_admin')
  @Get('chatbot')
  listChatbot(@Query('projectId') projectId?: string, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.auditLogsService.listChatbot(req?.user, projectId ? Number(projectId) : undefined);
  }
}
