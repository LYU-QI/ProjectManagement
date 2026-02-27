import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async list(actor: AuthActor | undefined, projectId?: number) {
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }
    const accessible = await this.accessService.getAccessibleProjectIds(actor);
    return this.prisma.auditLog.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(accessible === null
          ? {}
          : {
            OR: [
              { projectId: null },
              { projectId: { in: accessible } }
            ]
          })
      },
      orderBy: { id: 'desc' },
      take: 200
    });
  }

  async listChatbot(actor: AuthActor | undefined, projectId?: number) {
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }
    const accessible = await this.accessService.getAccessibleProjectIds(actor);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        method: 'AI_CHAT',
        ...(projectId ? { projectId } : {}),
        ...(accessible === null
          ? {}
          : {
            OR: [
              { projectId: null },
              { projectId: { in: accessible } }
            ]
          })
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
