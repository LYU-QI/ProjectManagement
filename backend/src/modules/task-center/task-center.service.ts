import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

export type TaskCenterSource = 'pm_assistant' | 'automation' | 'feishu' | 'ai_chat';
export type TaskCenterStatus = 'success' | 'failed' | 'dry-run' | 'skipped' | 'unknown';

export interface TaskCenterItem {
  id: string;
  source: TaskCenterSource;
  sourceLabel: string;
  status: TaskCenterStatus;
  title: string;
  summary: string;
  trigger?: string;
  actorName?: string;
  projectId?: number | null;
  projectName?: string | null;
  createdAt: string;
  detail?: string | null;
  retryable?: boolean;
  retryMeta?: Record<string, unknown> | null;
}

export interface TaskCenterStats {
  total: number;
  bySource: Record<TaskCenterSource, number>;
  byStatus: Record<TaskCenterStatus, number>;
  bySourceStatus: Record<TaskCenterSource, Record<TaskCenterStatus, number>>;
  successRate: number;
  recentFailures: Array<{
    id: string;
    title: string;
    sourceLabel: string;
    createdAt: string;
  }>;
  trend: Array<{
    day: string;
    total: number;
    failed: number;
  }>;
}

@Injectable()
export class TaskCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async list(
    actor: AuthActor | undefined,
    organizationId: string,
    params?: { projectId?: number; source?: TaskCenterSource; status?: TaskCenterStatus; limit?: number }
  ) {
    if (params?.projectId) {
      await this.accessService.assertProjectAccess(actor, params.projectId);
    }

    const accessibleProjectIds = await this.accessService.getAccessibleProjectIds(actor);
    const limit = Math.min(Math.max(params?.limit ?? 60, 1), 200);

    const [pmItems, automationItems, feishuItems, aiChatItems] = await Promise.all([
      params?.source && params.source !== 'pm_assistant'
        ? Promise.resolve<TaskCenterItem[]>([])
        : this.loadPmAssistantItems(organizationId, accessibleProjectIds, params?.projectId, limit),
      params?.source && params.source !== 'automation'
        ? Promise.resolve<TaskCenterItem[]>([])
        : this.loadAutomationItems(organizationId, accessibleProjectIds, params?.projectId, limit),
      params?.source && params.source !== 'feishu'
        ? Promise.resolve<TaskCenterItem[]>([])
        : this.loadFeishuItems(organizationId, accessibleProjectIds, params?.projectId, limit),
      params?.source && params.source !== 'ai_chat'
        ? Promise.resolve<TaskCenterItem[]>([])
        : this.loadAiChatItems(organizationId, accessibleProjectIds, params?.projectId, limit)
    ]);

    return [...pmItems, ...automationItems, ...feishuItems, ...aiChatItems]
      .filter((item) => (params?.status ? item.status === params.status : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async getStats(
    actor: AuthActor | undefined,
    organizationId: string,
    params?: { projectId?: number; source?: TaskCenterSource; days?: number }
  ): Promise<TaskCenterStats> {
    if (params?.projectId) {
      await this.accessService.assertProjectAccess(actor, params.projectId);
    }

    const accessibleProjectIds = await this.accessService.getAccessibleProjectIds(actor);
    const days = Math.min(Math.max(params?.days ?? 7, 1), 30);
    const take = Math.max(days * 80, 200);
    const items = await this.loadItemsRaw(organizationId, accessibleProjectIds, {
      projectId: params?.projectId,
      source: params?.source,
      take
    });

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const recentItems = items.filter((item) => new Date(item.createdAt) >= start);

    const bySource: Record<TaskCenterSource, number> = {
      pm_assistant: 0,
      automation: 0,
      feishu: 0,
      ai_chat: 0
    };
    const byStatus: Record<TaskCenterStatus, number> = {
      success: 0,
      failed: 0,
      'dry-run': 0,
      skipped: 0,
      unknown: 0
    };
    const bySourceStatus: Record<TaskCenterSource, Record<TaskCenterStatus, number>> = {
      pm_assistant: { success: 0, failed: 0, 'dry-run': 0, skipped: 0, unknown: 0 },
      automation: { success: 0, failed: 0, 'dry-run': 0, skipped: 0, unknown: 0 },
      feishu: { success: 0, failed: 0, 'dry-run': 0, skipped: 0, unknown: 0 },
      ai_chat: { success: 0, failed: 0, 'dry-run': 0, skipped: 0, unknown: 0 }
    };

    for (const item of recentItems) {
      bySource[item.source] += 1;
      byStatus[item.status as TaskCenterStatus] += 1;
      bySourceStatus[item.source][item.status as TaskCenterStatus] += 1;
    }

    const successBase = byStatus.success + byStatus.failed + byStatus['dry-run'] + byStatus.skipped;
    const successRate = successBase > 0 ? Math.round((byStatus.success / successBase) * 100) : 0;

    const recentFailures = recentItems
      .filter((item) => item.status === 'failed')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        sourceLabel: item.sourceLabel,
        createdAt: item.createdAt
      }));

    const trendMap = new Map<string, { total: number; failed: number }>();
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      trendMap.set(date.toISOString().slice(0, 10), { total: 0, failed: 0 });
    }
    for (const item of recentItems) {
      const key = item.createdAt.slice(0, 10);
      const bucket = trendMap.get(key);
      if (!bucket) continue;
      bucket.total += 1;
      if (item.status === 'failed') {
        bucket.failed += 1;
      }
    }

    return {
      total: recentItems.length,
      bySource,
      byStatus,
      bySourceStatus,
      successRate,
      recentFailures,
      trend: Array.from(trendMap.entries()).map(([day, value]) => ({
        day: day.slice(5),
        total: value.total,
        failed: value.failed
      }))
    };
  }

  private async loadItemsRaw(
    organizationId: string,
    accessibleProjectIds: number[] | null,
    params?: { projectId?: number; source?: TaskCenterSource; take?: number }
  ) {
    const take = Math.min(Math.max(params?.take ?? 200, 1), 1000);
    const [pmItems, automationItems, feishuItems, aiChatItems] = await Promise.all([
      params?.source && params.source !== 'pm_assistant'
        ? Promise.resolve<TaskCenterItem[]>([])
        : this.loadPmAssistantItems(organizationId, accessibleProjectIds, params?.projectId, take),
      params?.source && params.source !== 'automation'
        ? Promise.resolve<TaskCenterItem[]>([])
        : this.loadAutomationItems(organizationId, accessibleProjectIds, params?.projectId, take),
      params?.source && params.source !== 'feishu'
        ? Promise.resolve<TaskCenterItem[]>([])
        : this.loadFeishuItems(organizationId, accessibleProjectIds, params?.projectId, take),
      params?.source && params.source !== 'ai_chat'
        ? Promise.resolve<TaskCenterItem[]>([])
        : this.loadAiChatItems(organizationId, accessibleProjectIds, params?.projectId, take)
    ]);
    return [...pmItems, ...automationItems, ...feishuItems, ...aiChatItems]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private async loadPmAssistantItems(
    organizationId: string,
    accessibleProjectIds: number[] | null,
    projectId: number | undefined,
    take: number
  ) {
    const rows = await this.prisma.pmAssistantLog.findMany({
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
        ...(accessibleProjectIds === null ? {} : { projectId: { in: accessibleProjectIds } })
      },
      orderBy: { createdAt: 'desc' },
      take
    });
    const projectMap = await this.getProjectNameMap(rows.map((row) => row.projectId));
    return rows.map((row) => ({
      id: `pm-${row.id}`,
      source: 'pm_assistant' as const,
      sourceLabel: 'PM 助手',
      status: row.status as TaskCenterStatus,
      title: `PM 助手 · ${row.jobId}`,
      summary: row.summary || row.error || 'PM 助手任务执行',
      trigger: row.triggeredBy,
      projectId: row.projectId,
      projectName: row.projectId ? (projectMap.get(row.projectId) ?? null) : null,
      createdAt: row.createdAt.toISOString(),
      detail: [
        row.error ? `错误：${row.error}` : '',
        row.rawSummary ? `原始摘要：\n${row.rawSummary}` : '',
        row.aiSummary ? `AI 摘要：\n${row.aiSummary}` : ''
      ].filter(Boolean).join('\n\n') || null,
      retryable: true,
      retryMeta: {
        jobId: row.jobId,
        projectId: row.projectId
      }
    }));
  }

  private async loadAutomationItems(
    organizationId: string,
    _accessibleProjectIds: number[] | null,
    projectId: number | undefined,
    take: number
  ) {
    if (projectId) {
      return [];
    }
    const rows = await this.prisma.automationLog.findMany({
      where: {
        rule: {
          organizationId
        }
      },
      include: {
        rule: {
          select: {
            name: true
          }
        }
      },
      orderBy: { executionAt: 'desc' },
      take
    });
    return rows.map((row) => ({
      id: `automation-${row.id}`,
      source: 'automation' as const,
      sourceLabel: '自动化规则',
      status: row.success ? 'success' : 'failed',
      title: `自动化 · ${row.rule.name}`,
      summary: row.error || `触发器 ${row.trigger} 执行完成`,
      trigger: row.trigger,
      projectId: null,
      projectName: null,
      createdAt: row.executionAt.toISOString(),
      detail: [
        row.error ? `错误：${row.error}` : '',
        `触发器：${row.trigger}`,
        `输入载荷：\n${JSON.stringify(row.payload, null, 2)}`,
        `执行动作：\n${JSON.stringify(row.actionsRun, null, 2)}`
      ].filter(Boolean).join('\n\n'),
      retryable: true,
      retryMeta: {
        ruleId: row.ruleId,
        payload: row.payload
      }
    }));
  }

  private async loadFeishuItems(
    organizationId: string,
    accessibleProjectIds: number[] | null,
    projectId: number | undefined,
    take: number
  ) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        path: { contains: '/feishu/' },
        method: { in: ['POST', 'PUT', 'DELETE'] },
        ...(projectId ? { projectId } : {}),
        ...(accessibleProjectIds === null
          ? {}
          : {
            OR: [
              { projectId: null },
              { projectId: { in: accessibleProjectIds } }
            ]
          })
      },
      orderBy: { createdAt: 'desc' },
      take
    });
    const projectMap = await this.getProjectNameMap(rows.map((row) => row.projectId));
    return rows.map((row) => ({
      id: `feishu-${row.id}`,
      source: 'feishu' as const,
      sourceLabel: '飞书集成',
      status: 'unknown' as const,
      title: `飞书 · ${row.method} ${this.simplifyPath(row.path)}`,
      summary: this.buildFeishuSummary(row.method, row.path, row.requestBody),
      actorName: row.userName ?? undefined,
      projectId: row.projectId,
      projectName: row.projectId ? (projectMap.get(row.projectId) ?? null) : null,
      createdAt: row.createdAt.toISOString(),
      detail: `路径：${row.path}\n\n请求体：\n${JSON.stringify(row.requestBody ?? {}, null, 2)}`,
      retryable: false,
      retryMeta: null
    }));
  }

  private async loadAiChatItems(
    organizationId: string,
    accessibleProjectIds: number[] | null,
    projectId: number | undefined,
    take: number
  ) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        method: 'AI_CHAT',
        ...(projectId ? { projectId } : {}),
        ...(accessibleProjectIds === null
          ? {}
          : {
            OR: [
              { projectId: null },
              { projectId: { in: accessibleProjectIds } }
            ]
          })
      },
      orderBy: { createdAt: 'desc' },
      take
    });
    const projectMap = await this.getProjectNameMap(rows.map((row) => row.projectId));
    return rows.map((row) => {
      const body = row.requestBody && typeof row.requestBody === 'object'
        ? row.requestBody as Record<string, unknown>
        : {};
      const error = typeof body.error === 'string' ? body.error : '';
      const message = typeof body.message === 'string' ? body.message : '';
      const mode = typeof body.mode === 'string' ? body.mode : 'chat';
      return {
        id: `ai-chat-${row.id}`,
        source: 'ai_chat' as const,
        sourceLabel: 'AI 对话',
        status: error ? 'failed' as const : 'success' as const,
        title: `AI · ${mode}`,
        summary: error || message || 'AI 对话已执行',
        actorName: row.userName ?? undefined,
        projectId: row.projectId,
        projectName: row.projectId ? (projectMap.get(row.projectId) ?? null) : null,
        createdAt: row.createdAt.toISOString(),
        detail: [
          error ? `错误：${error}` : '',
          message ? `消息：\n${message}` : '',
          `模式：${mode}`,
          `请求体：\n${JSON.stringify(body, null, 2)}`
        ].filter(Boolean).join('\n\n'),
        retryable: false,
        retryMeta: null
      };
    });
  }

  private simplifyPath(path: string) {
    return path.replace(/^\/api\/v1\//, '/');
  }

  private buildFeishuSummary(method: string, path: string, requestBody: unknown) {
    const body = requestBody && typeof requestBody === 'object'
      ? requestBody as Record<string, unknown>
      : {};
    const projectId = body.projectId ? `projectId=${String(body.projectId)}` : '';
    const receiveId = body.receiveId ? `receiveId=${String(body.receiveId)}` : '';
    return [method, this.simplifyPath(path), projectId, receiveId].filter(Boolean).join(' · ');
  }

  private async getProjectNameMap(projectIds: Array<number | null | undefined>) {
    const ids = Array.from(new Set(projectIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)));
    if (ids.length === 0) return new Map<number, string>();
    const projects = await this.prisma.project.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true }
    });
    return new Map(projects.map((project) => [project.id, project.name]));
  }
}
