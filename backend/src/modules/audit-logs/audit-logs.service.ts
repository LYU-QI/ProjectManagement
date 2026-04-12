import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  private buildAuditScope(actor: AuthActor | undefined, projectId?: number) {
    const normalizedRole = this.accessService.normalizeRole(actor?.role);
    const isGlobalAuditReader = normalizedRole === 'super_admin' || normalizedRole === 'project_manager' || normalizedRole === 'project_director';
    return this.accessService.getAccessibleProjectIds(actor).then((accessible) => ({
      accessible,
      includeOrgLevel: isGlobalAuditReader || Boolean(projectId)
    }));
  }

  async list(actor: AuthActor | undefined, projectId?: number) {
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }
    const { accessible, includeOrgLevel } = await this.buildAuditScope(actor, projectId);
    return this.prisma.auditLog.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(accessible === null
          ? {}
          : {
            projectId: includeOrgLevel ? undefined : { in: accessible },
            ...(includeOrgLevel
              ? {
                OR: [
                  { projectId: null },
                  { projectId: { in: accessible } }
                ]
              }
              : {})
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
    const { accessible, includeOrgLevel } = await this.buildAuditScope(actor, projectId);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        method: 'AI_CHAT',
        ...(projectId ? { projectId } : {}),
        ...(accessible === null
          ? {}
          : {
            projectId: includeOrgLevel ? undefined : { in: accessible },
            ...(includeOrgLevel
              ? {
                OR: [
                  { projectId: null },
                  { projectId: { in: accessible } }
                ]
              }
              : {})
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
        organizationId: row.organizationId,
        createdAt: row.createdAt,
        source: row.source,
        outcome: row.outcome,
        statusCode: row.statusCode,
        errorMessage: row.errorMessage,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
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

  async exportCsv(actor: AuthActor | undefined, projectId?: number): Promise<string> {
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }
    const { accessible, includeOrgLevel } = await this.buildAuditScope(actor, projectId);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(accessible === null
          ? {}
          : {
            projectId: includeOrgLevel ? undefined : { in: accessible },
            ...(includeOrgLevel
              ? {
                OR: [
                  { projectId: null },
                  { projectId: { in: accessible } }
                ]
              }
              : {})
          })
      },
      orderBy: { id: 'desc' },
      take: 5000
    });

    const headers = ['ID', '时间', '用户ID', '用户名', '角色', '项目ID', '组织ID', '来源', '结果', '状态码', '错误信息', '资源类型', '资源ID', '变更前', '变更后', '方法', '路径'];
    const lines = [headers.join(',')];

    for (const row of rows) {
      lines.push([
        String(row.id),
        String(row.createdAt.toISOString()),
        String(row.userId ?? ''),
        String(row.userName ?? ''),
        String(row.userRole ?? ''),
        String(row.projectId ?? ''),
        String(row.organizationId ?? ''),
        String(row.source ?? ''),
        String(row.outcome ?? ''),
        String(row.statusCode ?? ''),
        String(row.errorMessage ?? '').replace(/,/g, ';'),
        String(row.resourceType ?? ''),
        String(row.resourceId ?? ''),
        JSON.stringify(row.beforeSnapshot ?? '').replace(/,/g, ';'),
        JSON.stringify(row.afterSnapshot ?? '').replace(/,/g, ';'),
        String(row.method ?? ''),
        String(row.path ?? '').replace(/,/g, ';')
      ].map(v => `"${v.replace(/"/g, '""')}"`).join(','));
    }

    return lines.join('\n');
  }
}
