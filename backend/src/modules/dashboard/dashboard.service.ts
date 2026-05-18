import { Injectable } from '@nestjs/common';
import { BugStatus, RequirementStatus, TaskStatus, WorkItemStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';
import { RedisService } from '../cache/cache.service';
import { ConfigService } from '../config/config.service';
import { FeishuService } from '../feishu/feishu.service';

type ClusterRiskLight = '红灯' | '黄灯' | '绿灯' | '未填';

type ClusterRiskBoardItem = {
  index: string;
  projectName: string;
  projectId: string;
  ownerPm: string;
  riskLight: ClusterRiskLight;
  deliveryScope: string;
  hasKeyDemo: boolean | null;
  weeklyProgress: string;
  dailyRiskHelp: string;
  riskResolution: string;
  qualityGap: string;
  qualityLevel: string;
};

type ClusterRiskBoardResponse = {
  generatedAt: string;
  source: 'feishu' | 'config_missing' | 'error';
  error?: string;
  summary: {
    totalProjects: number;
    redCount: number;
    yellowCount: number;
    greenCount: number;
    emptyRiskCount: number;
    keyDemoCount: number;
    dailyRiskHelpCount: number;
    highQualityRiskCount: number;
  };
  items: ClusterRiskBoardItem[];
};

const CLUSTER_FIELD_MAP: Record<keyof Omit<ClusterRiskBoardItem, 'hasKeyDemo'> | 'keyDemo', string> = {
  index: '序号',
  projectName: '重点项目',
  projectId: '项目ID（未立项不填）',
  ownerPm: '项目1号位和PM',
  riskLight: '风险情况',
  deliveryScope: '交付范围',
  keyDemo: '近期重点演示',
  weeklyProgress: '周进展（PM）',
  dailyRiskHelp: 'Daily风险求助（PM）',
  riskResolution: '风险解决情况',
  qualityGap: '质量状态与GAP-叶芳',
  qualityLevel: '质量等级'
};

@Injectable()
export class DashboardService {
  private readonly cacheTtl = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly feishuService: FeishuService
  ) {}

  async efficiency(projectId: number, actor?: AuthActor) {
    await this.accessService.assertProjectAccess(actor, projectId);

    const cacheKey = `dashboard:${projectId}:efficiency`;
    const cached = await this.redisService.get<ReturnType<typeof this.computeEfficiency>>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.computeEfficiency(projectId);
    await this.redisService.set(cacheKey, result, this.cacheTtl);
    return result;
  }

  private async computeEfficiency(projectId: number) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new Error('Project not found');
    }

    const [requirements, bugs, workItems, costEntries, worklogs, milestones] = await Promise.all([
      this.prisma.requirement.findMany({ where: { projectId } }),
      this.prisma.bug.findMany({ where: { projectId } }),
      this.prisma.workItem.findMany({ where: { projectId } }),
      this.prisma.costEntry.findMany({ where: { projectId } }),
      this.prisma.worklog.findMany({ where: { projectId } }),
      this.prisma.milestone.findMany({ where: { projectId } })
    ]);

    // Requirement metrics
    const requirementCount = requirements.length;
    const approvedCount = requirements.filter((r) => r.status === RequirementStatus.approved || r.status === RequirementStatus.planned || r.status === RequirementStatus.done).length;
    const doneReqCount = requirements.filter((r) => r.status === RequirementStatus.done).length;
    const approvedRate = requirementCount > 0 ? Math.round((approvedCount / requirementCount) * 100) : 0;
    const doneRate = requirementCount > 0 ? Math.round((doneReqCount / requirementCount) * 100) : 0;

    // Bug metrics
    const bugCount = bugs.length;
    const openBugCount = bugs.filter((b) => b.status === BugStatus.open || b.status === BugStatus.in_progress).length;
    const resolvedBugCount = bugs.filter((b) => b.status === BugStatus.resolved || b.status === BugStatus.closed).length;
    const resolvedBugs = bugs.filter((b) => b.status === BugStatus.resolved && b.resolvedAt);
    const avgResolutionDays =
      resolvedBugs.length > 0
        ? Number(
            (
              resolvedBugs.reduce((sum, b) => {
                const created = new Date(b.createdAt).getTime();
                const resolved = new Date(b.resolvedAt!).getTime();
                return sum + (resolved - created) / (1000 * 60 * 60 * 24);
              }, 0) / resolvedBugs.length
            ).toFixed(1)
          )
        : 0;

    // Work item metrics
    const workItemCount = workItems.length;
    const doneWorkItemCount = workItems.filter((w) => w.status === WorkItemStatus.done || w.status === WorkItemStatus.closed).length;
    const doneWorkItemRate = workItemCount > 0 ? Math.round((doneWorkItemCount / workItemCount) * 100) : 0;

    // Cost metrics
    const laborCost = worklogs.reduce((sum, w) => sum + w.hours * w.hourlyRate, 0);
    const outsourceCost = costEntries.filter((c) => c.type === 'outsource').reduce((sum, c) => sum + c.amount, 0);
    const cloudCost = costEntries.filter((c) => c.type === 'cloud').reduce((sum, c) => sum + c.amount, 0);
    const totalCost = laborCost + outsourceCost + cloudCost;

    // Milestone / schedule efficiency
    const onTimeMilestones = milestones.filter((m) => {
      if (!m.actualDate) return false;
      return m.actualDate <= m.plannedDate;
    });
    const onTimeDeliveryRate = milestones.length > 0 ? Math.round((onTimeMilestones.length / milestones.length) * 100) : 0;

    return {
      projectId,
      projectName: project.name,
      metrics: {
        requirementCount,
        approvedRate,
        doneRate,
        bugCount,
        openBugCount,
        resolvedBugCount,
        avgResolutionDays,
        sprintCount: 0,
        completedSprintCount: 0,
        workItemCount,
        doneWorkItemRate,
        totalCost,
        laborCost,
        outsourceCost,
        cloudCost,
        onTimeDeliveryRate
      }
    };
  }

  async overview(actor?: AuthActor) {
    const cacheKey = `dashboard:overview`;
    const cached = await this.redisService.get<ReturnType<typeof this.computeOverview>>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.computeOverview(actor);
    await this.redisService.set(cacheKey, result, this.cacheTtl);
    return result;
  }

  async clusterRiskBoard(actor?: AuthActor & { organizationId?: string }, force = false): Promise<ClusterRiskBoardResponse> {
    const cacheKey = `dashboard:cluster-risk-board:${actor?.organizationId ?? 'global'}`;
    if (!force) {
      const cached = await this.redisService.get<ClusterRiskBoardResponse>(cacheKey);
      if (cached) return cached;
    }

    const appToken = await this.getClusterConfig('CLUSTER_RISK_BOARD_APP_TOKEN', actor?.organizationId);
    const tableId = await this.getClusterConfig('CLUSTER_RISK_BOARD_TABLE_ID', actor?.organizationId);
    const viewId = await this.getClusterConfig('CLUSTER_RISK_BOARD_VIEW_ID', actor?.organizationId);
    const fieldMapRaw = await this.getClusterConfig('CLUSTER_RISK_BOARD_FIELD_MAP', actor?.organizationId);

    if (!appToken || !tableId) {
      return this.emptyClusterRiskBoard(
        'config_missing',
        '缺少 CLUSTER_RISK_BOARD_APP_TOKEN 或 CLUSTER_RISK_BOARD_TABLE_ID，请先在系统设置中配置大看板数据源。'
      );
    }

    try {
      const fieldMap = this.parseClusterFieldMap(fieldMapRaw);
      const data = await this.feishuService.listRecords({
        pageSize: 500,
        viewId: viewId || undefined,
        opts: { appToken, tableId }
      });
      const items = (data.items || [])
        .map((record) => this.normalizeClusterRecord((record as { fields?: Record<string, unknown> })?.fields || {}, fieldMap))
        .filter((item) => item.projectName || item.projectId || item.index)
        .sort((a, b) => this.riskSortWeight(a.riskLight) - this.riskSortWeight(b.riskLight));
      const response = this.buildClusterRiskBoardResponse('feishu', items);
      await this.redisService.set(cacheKey, response, this.cacheTtl);
      return response;
    } catch (err: any) {
      return this.emptyClusterRiskBoard('error', err?.message || '集群风险状态大看板数据加载失败。');
    }
  }

  private async computeOverview(actor?: AuthActor) {
    const accessibleProjectIds = await this.accessService.getAccessibleProjectIds(actor);
    const projectFilter = accessibleProjectIds === null
      ? undefined
      : { id: { in: accessibleProjectIds } };

    const projects = await this.prisma.project.findMany({
      where: projectFilter,
      orderBy: { id: 'asc' }
    });
    const ids = projects.map((item) => item.id);
    if (ids.length === 0) {
      return {
        summary: {
          projectCount: 0,
          requirementCount: 0,
          riskProjectCount: 0
        },
        projects: []
      };
    }

    const [requirements, costs, tasks, worklogs] = await Promise.all([
      this.prisma.requirement.findMany({ where: { projectId: { in: ids } }, orderBy: { id: 'asc' } }),
      this.prisma.costEntry.findMany({ where: { projectId: { in: ids } } }),
      this.prisma.task.findMany({ where: { projectId: { in: ids } } }),
      this.prisma.worklog.findMany({ where: { projectId: { in: ids } } })
    ]);

    const projectCards = projects.map((project) => {
      const projectRequirements = requirements.filter((item) => item.projectId === project.id);
      const projectCosts = costs.filter((item) => item.projectId === project.id);
      const projectWorklogs = worklogs.filter((item) => item.projectId === project.id);
      const blockedTasks = tasks.filter((item) => item.projectId === project.id && item.status === TaskStatus.blocked).length;
      const worklogLaborCost = projectWorklogs.reduce((sum, item) => sum + item.hours * item.hourlyRate, 0);
      const actualCost = projectCosts.reduce((sum, item) => sum + item.amount, 0) + worklogLaborCost;
      const varianceRate = project.budget === 0 ? 0 : +(((actualCost - project.budget) / project.budget) * 100).toFixed(2);
      const requirementRisk = projectRequirements.filter((item) => item.changeCount >= 2).length;
      const healthScore = Math.round(Math.max(0, 100 - Math.abs(varianceRate) - blockedTasks * 12 - requirementRisk * 8) * 100) / 100;

      return {
        projectId: project.id,
        projectName: project.name,
        requirementCount: projectRequirements.length,
        blockedTasks,
        actualCost,
        budget: project.budget,
        varianceRate,
        healthScore
      };
    });

    return {
      summary: {
        projectCount: projects.length,
        requirementCount: requirements.length,
        riskProjectCount: projectCards.filter((item) => item.healthScore < 70).length
      },
      projects: projectCards
    };
  }

  private async getClusterConfig(key: string, organizationId?: string): Promise<string> {
    return (await this.configService.get(key, organizationId))?.trim() || '';
  }

  private emptyClusterRiskBoard(source: 'config_missing' | 'error', error: string): ClusterRiskBoardResponse {
    return {
      generatedAt: new Date().toISOString(),
      source,
      error,
      summary: {
        totalProjects: 0,
        redCount: 0,
        yellowCount: 0,
        greenCount: 0,
        emptyRiskCount: 0,
        keyDemoCount: 0,
        dailyRiskHelpCount: 0,
        highQualityRiskCount: 0
      },
      items: []
    };
  }

  private buildClusterRiskBoardResponse(source: 'feishu', items: ClusterRiskBoardItem[]): ClusterRiskBoardResponse {
    return {
      generatedAt: new Date().toISOString(),
      source,
      summary: {
        totalProjects: items.length,
        redCount: items.filter((item) => item.riskLight === '红灯').length,
        yellowCount: items.filter((item) => item.riskLight === '黄灯').length,
        greenCount: items.filter((item) => item.riskLight === '绿灯').length,
        emptyRiskCount: items.filter((item) => item.riskLight === '未填').length,
        keyDemoCount: items.filter((item) => item.hasKeyDemo === true).length,
        dailyRiskHelpCount: items.filter((item) => Boolean(item.dailyRiskHelp.trim())).length,
        highQualityRiskCount: items.filter((item) => item.qualityLevel.includes('高') || item.qualityGap.includes('高风险')).length
      },
      items
    };
  }

  private normalizeClusterRecord(fields: Record<string, unknown>, fieldMap: Record<string, string>): ClusterRiskBoardItem {
    const get = (key: keyof Omit<ClusterRiskBoardItem, 'hasKeyDemo'> | 'keyDemo') => this.fieldValue(fields, fieldMap[key] || CLUSTER_FIELD_MAP[key]);
    const qualityLevel = get('qualityLevel') || this.findBlankHeaderValue(fields) || this.inferQualityLevel(get('qualityGap'));
    return {
      index: get('index'),
      projectName: get('projectName'),
      projectId: get('projectId'),
      ownerPm: get('ownerPm'),
      riskLight: this.normalizeRiskLight(get('riskLight')),
      deliveryScope: get('deliveryScope'),
      hasKeyDemo: this.normalizeYesNo(get('keyDemo')),
      weeklyProgress: get('weeklyProgress'),
      dailyRiskHelp: get('dailyRiskHelp'),
      riskResolution: get('riskResolution'),
      qualityGap: get('qualityGap'),
      qualityLevel
    };
  }

  private parseClusterFieldMap(raw?: string | null): Record<string, string> {
    if (!raw?.trim()) return { ...CLUSTER_FIELD_MAP };
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...CLUSTER_FIELD_MAP };
      return {
        ...CLUSTER_FIELD_MAP,
        ...Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .map(([key, value]) => [key.trim(), String(value ?? '').trim()])
            .filter(([key, value]) => key && value)
        )
      };
    } catch {
      return { ...CLUSTER_FIELD_MAP };
    }
  }

  private fieldValue(fields: Record<string, unknown>, desiredHeader: string): string {
    const normalizedDesired = this.normalizeFieldHeader(desiredHeader);
    const entry = Object.entries(fields).find(([key]) => this.normalizeFieldHeader(key) === normalizedDesired);
    return this.toPlainText(entry?.[1]);
  }

  private findBlankHeaderValue(fields: Record<string, unknown>): string {
    const blankEntry = Object.entries(fields).find(([key]) => this.normalizeFieldHeader(key) === '');
    return this.toPlainText(blankEntry?.[1]);
  }

  private normalizeFieldHeader(value: string): string {
    return String(value || '').replace(/\s+/g, '').trim();
  }

  private toPlainText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    if (Array.isArray(value)) {
      return value.map((item) => this.toPlainText(item)).filter(Boolean).join('、');
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const preferred = record.text ?? record.name ?? record.value ?? record.en_name ?? record.email;
      if (preferred !== undefined) return this.toPlainText(preferred);
      return Object.values(record).map((item) => this.toPlainText(item)).filter(Boolean).join('、');
    }
    return '';
  }

  private normalizeRiskLight(value: string): ClusterRiskLight {
    const text = value.replace(/\s+/g, '');
    if (text.includes('红')) return '红灯';
    if (text.includes('黄')) return '黄灯';
    if (text.includes('绿')) return '绿灯';
    return '未填';
  }

  private normalizeYesNo(value: string): boolean | null {
    const text = value.trim().toLowerCase();
    if (!text) return null;
    if (['是', 'yes', 'y', 'true', '1', '有'].includes(text)) return true;
    if (['否', 'no', 'n', 'false', '0', '无'].includes(text)) return false;
    return null;
  }

  private inferQualityLevel(value: string): string {
    if (value.includes('高')) return '高';
    if (value.includes('中')) return '中';
    if (value.includes('低')) return '低';
    return '';
  }

  private riskSortWeight(value: ClusterRiskLight): number {
    if (value === '红灯') return 0;
    if (value === '黄灯') return 1;
    if (value === '绿灯') return 2;
    return 3;
  }
}
