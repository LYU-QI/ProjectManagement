import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';
import { AutomationService } from '../automation/automation.service';
import { PmAssistantService } from '../pm-assistant/pm-assistant.service';

export type TaskCenterSource = 'pm_assistant' | 'automation' | 'feishu' | 'ai_chat';
export type TaskCenterStatus = 'success' | 'failed' | 'dry-run' | 'skipped' | 'unknown';
export type TaskCenterSeverity = 'info' | 'warning' | 'critical';

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
  errorCode?: string | null;
  errorCategory?: string | null;
  severity?: 'info' | 'warning' | 'critical';
  recoveryHint?: string | null;
  recoveryEntry?: string | null;
  recoveryChecklist?: string[];
  retryable?: boolean;
  retryMeta?: Record<string, unknown> | null;
}

export interface TaskCenterStats {
  total: number;
  bySource: Record<TaskCenterSource, number>;
  byStatus: Record<TaskCenterStatus, number>;
  bySourceStatus: Record<TaskCenterSource, Record<TaskCenterStatus, number>>;
  successRate: number;
  topErrorCodes: Array<{
    errorCode: string;
    count: number;
    severity: TaskCenterSeverity;
    sourceLabel: string;
  }>;
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
    private readonly accessService: AccessService,
    private readonly pmAssistantService: PmAssistantService,
    private readonly automationService: AutomationService
  ) {}

  private classifyFailure(
    source: TaskCenterSource,
    status: TaskCenterStatus,
    detail: string | null | undefined,
    summary: string
  ) {
    const text = `${summary}\n${detail || ''}`.toLowerCase();

    if (status !== 'failed' && source !== 'feishu') {
      return {
        errorCode: null,
        errorCategory: null,
        severity: status === 'success' ? 'info' as const : 'warning' as const,
        recoveryHint: null,
        recoveryEntry: null,
        recoveryChecklist: []
      };
    }

    if (source === 'feishu') {
      if (text.includes('91403') || text.includes('forbidden') || text.includes('权限不足')) {
        return {
          errorCode: 'TC-FEI-403',
          errorCategory: 'feishu_permission',
          severity: 'critical' as const,
          recoveryHint: '检查飞书应用是否已添加为多维表协作者，并确认应用具备多维表格读写权限。',
          recoveryEntry: '项目管理 > 飞书集成配置',
          recoveryChecklist: [
            '确认当前项目已配置正确的 feishuAppToken 和 feishuTableId。',
            '在飞书多维表格中把当前应用添加为协作者。',
            '检查应用是否开通多维表格读写权限，而不只是只读权限。',
            '确认 FEISHU_APP_ID / FEISHU_APP_SECRET 与当前表属于同一应用和租户。'
          ]
        };
      }
      if (text.includes('userfieldconvfail')) {
        return {
          errorCode: 'TC-FEI-422',
          errorCategory: 'feishu_user_mapping',
          severity: 'warning' as const,
          recoveryHint: '检查负责人字段映射，确认当前写入值能被飞书识别为有效成员。',
          recoveryEntry: '飞书集成 > 人员映射',
          recoveryChecklist: [
            '检查写入字段是否为飞书成员字段，而不是普通文本字段。',
            '确认当前负责人名称已能映射到有效的飞书 open_id。',
            '在飞书集成页核对人员映射数据是否已同步到最新。'
          ]
        };
      }
      return {
        errorCode: 'TC-FEI-000',
        errorCategory: 'feishu_write_pending',
        severity: 'warning' as const,
        recoveryHint: '如果飞书数据未更新，请对照审计日志中的请求体与实际多维表字段，确认写回是否成功。',
        recoveryEntry: '任务中心详情 / 审计日志',
        recoveryChecklist: [
          '先核对任务中心详情中的请求体与飞书表字段名是否一致。',
          '确认当前项目作用域是否指向了正确的飞书表。',
          '如果页面已更新但飞书未变，重新查询飞书并检查是否存在旧分页或旧筛选条件。'
        ]
      };
    }

    if (text.includes('missing_ai_config') || text.includes('ai 模型未配置')) {
      return {
        errorCode: 'TC-AI-401',
        errorCategory: 'ai_config_missing',
        severity: 'critical' as const,
        recoveryHint: '前往系统配置补齐 AI_API_URL、AI_API_KEY 和 AI_MODEL。',
        recoveryEntry: '系统配置 > AI',
        recoveryChecklist: []
      };
    }
    if (text.includes('timeout')) {
      return {
        errorCode: 'TC-CMN-408',
        errorCategory: 'request_timeout',
        severity: 'warning' as const,
        recoveryHint: '目标服务响应超时，建议稍后重试，并检查外部服务连通性。',
        recoveryEntry: '任务中心 > 重试',
        recoveryChecklist: []
      };
    }
    if (text.includes('未找到可用群聊 chat id') || text.includes('chat id')) {
      return {
        errorCode: 'TC-PMA-404',
        errorCategory: 'chat_id_missing',
        severity: 'critical' as const,
        recoveryHint: '请先在项目配置中补充飞书群 chat_id，再重新执行任务。',
        recoveryEntry: '项目管理 > 飞书群配置',
        recoveryChecklist: []
      };
    }
    if (text.includes('forbidden') || text.includes('no access') || text.includes('无权限')) {
      return {
        errorCode: 'TC-AUTH-403',
        errorCategory: 'permission_denied',
        severity: 'critical' as const,
        recoveryHint: '请检查当前账号的组织/项目权限，确认该任务对应资源可访问。',
        recoveryEntry: '组织成员 / 项目权限',
        recoveryChecklist: []
      };
    }
    if (text.includes('缺少') || text.includes('missing')) {
      return {
        errorCode: 'TC-REQ-400',
        errorCategory: 'input_missing',
        severity: 'warning' as const,
        recoveryHint: '请补全任务执行所需的输入条件后再重试。',
        recoveryEntry: '原业务页面补全输入',
        recoveryChecklist: []
      };
    }
    return {
      errorCode: source === 'pm_assistant'
        ? 'TC-PMA-500'
        : source === 'automation'
          ? 'TC-AUT-500'
          : source === 'ai_chat'
            ? 'TC-AI-500'
            : 'TC-CMN-500',
      errorCategory: 'execution_failed',
      severity: 'warning' as const,
      recoveryHint: '请查看详情中的错误上下文，修正配置或数据后再重试。',
      recoveryEntry: '任务中心详情 / 重试',
      recoveryChecklist: []
    };
  }

  async retry(
    actor: AuthActor | undefined,
    _organizationId: string,
    source: TaskCenterSource,
    retryMeta: Record<string, unknown>
  ) {
    if (source === 'pm_assistant') {
      const jobId = String(retryMeta.jobId || '').trim();
      const projectId = typeof retryMeta.projectId === 'number' ? retryMeta.projectId : undefined;
      if (!jobId) throw new BadRequestException('缺少 PM 助手任务标识');
      if (projectId) {
        await this.accessService.assertProjectAccess(actor, projectId);
      }
      await this.pmAssistantService.runJob(jobId as any, {
        projectId,
        triggeredBy: 'manual'
      });
      return { success: true, errorCode: null, message: `已重新触发 PM 助手任务：${jobId}` };
    }

    if (source === 'automation') {
      const ruleId = String(retryMeta.ruleId || '').trim();
      if (!ruleId) throw new BadRequestException('缺少自动化规则标识');
      const payload = retryMeta.payload && typeof retryMeta.payload === 'object' ? retryMeta.payload : {};
      const result = await this.automationService.testRule(actor, ruleId, payload);
      return {
        success: result.success,
        errorCode: result.success ? null : 'TC-AUT-500',
        message: result.message
      };
    }

    throw new BadRequestException('当前来源暂不支持统一重试');
  }

  async list(
    actor: AuthActor | undefined,
    organizationId: string,
    params?: {
      projectId?: number;
      source?: TaskCenterSource;
      status?: TaskCenterStatus;
      severity?: TaskCenterSeverity;
      errorCode?: string;
      limit?: number;
    }
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
      .filter((item) => (params?.severity ? item.severity === params.severity : true))
      .filter((item) => (params?.errorCode ? item.errorCode === params.errorCode : true))
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
    const topErrorCodes = Array.from(
      recentItems
        .filter((item) => item.status === 'failed' && item.errorCode)
        .reduce((acc, item) => {
          const key = String(item.errorCode);
          const current = acc.get(key) || {
            errorCode: key,
            count: 0,
            severity: (item.severity || 'warning') as TaskCenterSeverity,
            sourceLabel: item.sourceLabel
          };
          current.count += 1;
          if (current.severity !== 'critical' && item.severity === 'critical') {
            current.severity = 'critical';
          }
          acc.set(key, current);
          return acc;
        }, new Map<string, { errorCode: string; count: number; severity: TaskCenterSeverity; sourceLabel: string }>())
        .values()
    )
      .sort((a, b) => b.count - a.count || a.errorCode.localeCompare(b.errorCode))
      .slice(0, 5);

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
      topErrorCodes,
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
    return rows.map((row) => {
      const status = row.status as TaskCenterStatus;
      const detail = [
        row.error ? `错误：${row.error}` : '',
        row.rawSummary ? `原始摘要：\n${row.rawSummary}` : '',
        row.aiSummary ? `AI 摘要：\n${row.aiSummary}` : ''
      ].filter(Boolean).join('\n\n') || null;
      const summary = row.summary || row.error || 'PM 助手任务执行';
      const failure = this.classifyFailure('pm_assistant', status, detail, summary);
      return {
        id: `pm-${row.id}`,
        source: 'pm_assistant' as const,
        sourceLabel: 'PM 助手',
        status,
        title: `PM 助手 · ${row.jobId}`,
        summary,
        trigger: row.triggeredBy,
        projectId: row.projectId,
        projectName: row.projectId ? (projectMap.get(row.projectId) ?? null) : null,
        createdAt: row.createdAt.toISOString(),
        detail,
        errorCode: failure.errorCode,
        errorCategory: failure.errorCategory,
        severity: failure.severity,
        recoveryHint: failure.recoveryHint,
        recoveryEntry: failure.recoveryEntry,
        recoveryChecklist: failure.recoveryChecklist,
        retryable: true,
        retryMeta: {
          jobId: row.jobId,
          projectId: row.projectId
        }
      };
    });
  }

  private async loadAutomationItems(
    organizationId: string,
    _accessibleProjectIds: number[] | null,
    _projectId: number | undefined,
    take: number
  ) {
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
    return rows.map((row) => {
      const status = row.success ? 'success' as const : 'failed' as const;
      const detail = [
        row.error ? `错误：${row.error}` : '',
        `触发器：${row.trigger}`,
        `输入载荷：\n${JSON.stringify(row.payload, null, 2)}`,
        `执行动作：\n${JSON.stringify(row.actionsRun, null, 2)}`
      ].filter(Boolean).join('\n\n');
      const summary = row.error || `触发器 ${row.trigger} 执行完成`;
      const failure = this.classifyFailure('automation', status, detail, summary);
      return {
        id: `automation-${row.id}`,
        source: 'automation' as const,
        sourceLabel: '自动化规则',
        status,
        title: `自动化 · ${row.rule.name}`,
        summary,
        trigger: row.trigger,
        projectId: null,
        projectName: null,
        createdAt: row.executionAt.toISOString(),
        detail,
        errorCode: failure.errorCode,
        errorCategory: failure.errorCategory,
        severity: failure.severity,
        recoveryHint: failure.recoveryHint,
        recoveryEntry: failure.recoveryEntry,
        recoveryChecklist: failure.recoveryChecklist,
        retryable: true,
        retryMeta: {
          ruleId: row.ruleId,
          payload: row.payload
        }
      };
    });
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
    return rows.map((row) => {
      const summary = this.buildFeishuSummary(row.method, row.path, row.requestBody);
      const detail = `路径：${row.path}\n\n请求体：\n${JSON.stringify(row.requestBody ?? {}, null, 2)}`;
      const failure = this.classifyFailure('feishu', 'unknown', detail, summary);
      const status = failure.errorCode && failure.errorCode !== 'TC-FEI-000'
        ? 'failed' as const
        : 'unknown' as const;
      return {
        id: `feishu-${row.id}`,
        source: 'feishu' as const,
        sourceLabel: '飞书集成',
        status,
        title: `飞书 · ${row.method} ${this.simplifyPath(row.path)}`,
        summary,
        actorName: row.userName ?? undefined,
        projectId: row.projectId,
        projectName: row.projectId ? (projectMap.get(row.projectId) ?? null) : null,
        createdAt: row.createdAt.toISOString(),
        detail,
        errorCode: failure.errorCode,
        errorCategory: failure.errorCategory,
        severity: failure.severity,
        recoveryHint: failure.recoveryHint,
        recoveryEntry: failure.recoveryEntry,
        recoveryChecklist: failure.recoveryChecklist,
        retryable: false,
        retryMeta: null
      };
    });
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
      const status = error ? 'failed' as const : 'success' as const;
      const summary = error || message || 'AI 对话已执行';
      const detail = [
        error ? `错误：${error}` : '',
        message ? `消息：\n${message}` : '',
        `模式：${mode}`,
        `请求体：\n${JSON.stringify(body, null, 2)}`
      ].filter(Boolean).join('\n\n');
      const failure = this.classifyFailure('ai_chat', status, detail, summary);
      return {
        id: `ai-chat-${row.id}`,
        source: 'ai_chat' as const,
        sourceLabel: 'AI 对话',
        status,
        title: `AI · ${mode}`,
        summary,
        actorName: row.userName ?? undefined,
        projectId: row.projectId,
        projectName: row.projectId ? (projectMap.get(row.projectId) ?? null) : null,
        createdAt: row.createdAt.toISOString(),
        detail,
        errorCode: failure.errorCode,
        errorCategory: failure.errorCategory,
        severity: failure.severity,
        recoveryHint: failure.recoveryHint,
        recoveryEntry: failure.recoveryEntry,
        recoveryChecklist: failure.recoveryChecklist,
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
