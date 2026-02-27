import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId?: number) {
    return this.prisma.auditLog.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { id: 'desc' },
      take: 200
    });
  }

  async listChatbot(projectId?: number) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        method: 'AI_CHAT',
        ...(projectId ? { projectId } : {})
      },
      orderBy: { id: 'desc' },
      take: 200
    });

    return rows.map((row) => {
      const payload = (row.requestBody && typeof row.requestBody === 'object')
        ? (row.requestBody as Record<string, unknown>)
        : {};
      return {
        id: row.id,
        userName: row.userName,
        userRole: row.userRole,
        projectId: row.projectId,
        createdAt: row.createdAt,
        mode: String(payload.mode || ''),
        message: String(payload.message || ''),
        resultContent: String(payload.resultContent || ''),
        error: String(payload.error || ''),
        detailScope: String(payload.detailScope || ''),
        scopedProjectNames: Array.isArray(payload.scopedProjectNames) ? payload.scopedProjectNames : [],
        trace: Array.isArray(payload.trace) ? payload.trace : [],
        toolCalls: Array.isArray(payload.toolCalls) ? payload.toolCalls : []
      };
    });
  }
}
