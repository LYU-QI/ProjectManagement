import { Controller, Get, Query, Req, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../auth/roles.decorator';
import { AuditLogsService } from './audit-logs.service';

@Controller('api/v1/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Roles('project_manager', 'pm', 'super_admin')
  @Get()
  list(@Query('projectId') projectId?: string, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.auditLogsService.list(req?.user, projectId ? Number(projectId) : undefined);
  }

  @Roles('project_manager', 'pm', 'super_admin')
  @Get('chatbot')
  listChatbot(@Query('projectId') projectId?: string, @Req() req?: { user?: { sub?: number; role?: string } }) {
    return this.auditLogsService.listChatbot(req?.user, projectId ? Number(projectId) : undefined);
  }

  @Roles('project_manager', 'pm', 'super_admin')
  @Get('export')
  async exportCsv(
    @Query('projectId') projectId?: string,
    @Req() req?: { user?: { sub?: number; role?: string } },
    @Res() res?: Response
  ) {
    const csv = await this.auditLogsService.exportCsv(req?.user, projectId ? Number(projectId) : undefined);
    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res?.send(csv);
  }
}
