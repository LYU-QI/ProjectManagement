import { Injectable } from '@nestjs/common';
import { NotificationLevel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FeishuService } from '../feishu/feishu.service';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

const RULE_KEY = 'deadline_progress';

@Injectable()
export class RisksService {
  constructor(
    private readonly feishuService: FeishuService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  private parseDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string') {
      const ts = Date.parse(value);
      if (!Number.isNaN(ts)) return new Date(ts);
    }
    return null;
  }

  private formatDate(value: Date | null): string | null {
    if (!value) return null;
    return value.toISOString().slice(0, 10);
  }

  private parseProgress(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value <= 1 ? value * 100 : value;
    }
    if (typeof value === 'string') {
      const trimmed = value.replace('%', '').trim();
      const num = Number(trimmed);
      if (!Number.isFinite(num)) return 0;
      return num <= 1 ? num * 100 : num;
    }
    return 0;
  }

  private extractAssignee(value: unknown): string {
    if (Array.isArray(value)) {
      const names = value
        .map((item) => {
          if (item && typeof item === 'object') {
            const candidate = (item as any).name || (item as any).en_name || (item as any).id;
            if (candidate) return String(candidate);
          }
          if (typeof item === 'string') return item;
          return '';
        })
        .filter(Boolean);
      return names.join(', ');
    }
    if (typeof value === 'string') return value;
    return '';
  }

  private async getOrCreateRule() {
    const existing = await this.prisma.riskRule.findUnique({ where: { key: RULE_KEY } });
    if (existing) return existing;
    return this.prisma.riskRule.create({
      data: {
        key: RULE_KEY,
        type: 'deadline_progress',
        name: '截止时间临近且进度偏低',
        thresholdDays: 7,
        progressThreshold: 80,
        includeMilestones: false,
        autoNotify: true,
        enabled: true
      }
    });
  }

  private async getOrCreateBlockedRule() {
    const key = 'blocked_tasks';
    const existing = await this.prisma.riskRule.findUnique({ where: { key } });
    if (existing) return existing;
    return this.prisma.riskRule.create({
      data: {
        key,
        type: 'blocked',
        name: '任务阻塞预警',
        thresholdDays: 0,
        progressThreshold: 0,
        blockedValue: '是',
        includeMilestones: false,
        autoNotify: true,
        enabled: true
      }
    });
  }

  private async getOrCreateOverdueRule() {
    const key = 'overdue_tasks';
    const existing = await this.prisma.riskRule.findUnique({ where: { key } });
    if (existing) return existing;
    return this.prisma.riskRule.create({
      data: {
        key,
        type: 'overdue',
        name: '任务延期预警',
        thresholdDays: 0,
        progressThreshold: 0,
        includeMilestones: false,
        autoNotify: true,
        enabled: true
      }
    });
  }

  async getRule() {
    return this.getOrCreateRule();
  }

  async listRules() {
    await Promise.all([this.getOrCreateRule(), this.getOrCreateBlockedRule(), this.getOrCreateOverdueRule()]);
    return this.prisma.riskRule.findMany({ orderBy: { id: 'asc' } });
  }

  async triggerAutoNotify(projectName?: string) {
    const rule = await this.getOrCreateRule();
    if (!rule.enabled || !rule.autoNotify) return;
    const project = projectName?.trim();
    if (!project) return;
    await this.listRisks({
      filterProject: project,
      thresholdDays: String(rule.thresholdDays),
      progressThreshold: String(rule.progressThreshold),
      includeMilestones: String(rule.includeMilestones)
    });
    await this.listAllRisks({
      filterProject: project
    });
  }

  async updateRule(input: {
    key?: string;
    thresholdDays?: number;
    progressThreshold?: number;
    includeMilestones?: boolean;
    autoNotify?: boolean;
    enabled?: boolean;
    blockedValue?: string;
  }) {
    const existing = input.key
      ? await this.prisma.riskRule.findUnique({ where: { key: input.key } })
      : await this.getOrCreateRule();
    if (!existing) {
      return this.getOrCreateRule();
    }
    const noteParts: string[] = [];
    if (input.thresholdDays !== undefined && input.thresholdDays !== existing.thresholdDays) noteParts.push(`thresholdDays=${input.thresholdDays}`);
    if (input.progressThreshold !== undefined && input.progressThreshold !== existing.progressThreshold) noteParts.push(`progressThreshold=${input.progressThreshold}`);
    if (input.includeMilestones !== undefined && input.includeMilestones !== existing.includeMilestones) noteParts.push(`includeMilestones=${input.includeMilestones}`);
    if (input.autoNotify !== undefined && input.autoNotify !== existing.autoNotify) noteParts.push(`autoNotify=${input.autoNotify}`);
    if (input.enabled !== undefined && input.enabled !== existing.enabled) noteParts.push(`enabled=${input.enabled}`);
    if (input.blockedValue !== undefined && input.blockedValue !== existing.blockedValue) noteParts.push(`blockedValue=${input.blockedValue}`);
    return this.prisma.riskRule.update({
      where: { id: existing.id },
      data: {
        thresholdDays: input.thresholdDays ?? existing.thresholdDays,
        progressThreshold: input.progressThreshold ?? existing.progressThreshold,
        includeMilestones: input.includeMilestones ?? existing.includeMilestones,
        autoNotify: input.autoNotify ?? existing.autoNotify,
        enabled: input.enabled ?? existing.enabled,
        blockedValue: input.blockedValue ?? existing.blockedValue
      }
    }).then(async (rule) => {
      if (noteParts.length > 0) {
        await this.prisma.riskRuleLog.create({
          data: {
            ruleId: rule.id,
            action: 'update',
            note: noteParts.join(', ')
          }
        });
      }
      return rule;
    });
  }

  async listRisks(query: {
    thresholdDays?: string;
    progressThreshold?: string;
    viewId?: string;
    filterProject?: string;
    filterStatus?: string;
    filterAssignee?: string;
    filterRisk?: string;
    includeMilestones?: string;
  }) {
    const rule = await this.getOrCreateRule();
    const thresholdDays = parseNumber(query.thresholdDays, rule.thresholdDays);
    const progressThreshold = parseNumber(query.progressThreshold, rule.progressThreshold);
    const includeMilestones = query.includeMilestones !== undefined
      ? query.includeMilestones === 'true'
      : rule.includeMilestones;

    const records = await this.feishuService.listRecords({
      pageSize: 500,
      viewId: query.viewId,
      fieldNames: '任务ID,任务名称,状态,优先级,负责人,开始时间,截止时间,进度,所属项目,是否阻塞,阻塞原因,风险等级,里程碑',
      filterProject: query.filterProject,
      filterStatus: query.filterStatus,
      filterAssignee: query.filterAssignee,
      filterRisk: query.filterRisk
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = (records.items || [])
      .map((record: any) => {
        const fields = (record?.fields || {}) as Record<string, unknown>;
        const start = this.parseDate(fields['开始时间']);
        const end = this.parseDate(fields['截止时间']);
        const progress = this.parseProgress(fields['进度']);
        const milestone = String(fields['里程碑'] ?? '否');
        const daysLeft = end ? Math.ceil((end.getTime() - today.getTime()) / DAY_MS) : null;

        return {
          recordId: String(record.record_id ?? ''),
          taskId: String(fields['任务ID'] ?? ''),
          taskName: String(fields['任务名称'] ?? ''),
          status: String(fields['状态'] ?? ''),
          priority: String(fields['优先级'] ?? ''),
          assignee: this.extractAssignee(fields['负责人']),
          project: String(fields['所属项目'] ?? ''),
          startDate: this.formatDate(start),
          endDate: this.formatDate(end),
          progress,
          daysLeft,
          blocked: String(fields['是否阻塞'] ?? ''),
          blockedReason: String(fields['阻塞原因'] ?? ''),
          riskLevel: String(fields['风险等级'] ?? ''),
          milestone
        };
      })
      .filter((item) => includeMilestones || item.milestone !== '是')
      .filter((item) => item.endDate && item.daysLeft !== null)
      .map((item) => ({
        ...item,
        overdue: (item.daysLeft ?? 0) < 0,
        ruleMatched: (item.daysLeft ?? 0) <= thresholdDays && item.progress < progressThreshold
      }))
      .filter((item) => item.ruleMatched)
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

    const response = {
      generatedAt: new Date().toISOString(),
      thresholdDays,
      progressThreshold,
      rules: [
        {
          id: RULE_KEY,
          name: rule.name,
          description: `截止日期 ≤ ${thresholdDays} 天 且 进度 < ${progressThreshold}%`,
          thresholdDays,
          progressThreshold
        }
      ],
      count: items.length,
      items
    };

    if (rule.enabled && rule.autoNotify && items.length > 0) {
      await this.syncNotifications(rule.id, items);
    }

    return response;
  }

  async listAllRisks(query: {
    viewId?: string;
    filterProject?: string;
    filterStatus?: string;
    filterAssignee?: string;
    filterRisk?: string;
  }) {
    const [deadlineRule, blockedRule, overdueRule] = await Promise.all([
      this.getOrCreateRule(),
      this.getOrCreateBlockedRule(),
      this.getOrCreateOverdueRule()
    ]);

    const records = await this.feishuService.listRecords({
      pageSize: 500,
      viewId: query.viewId,
      fieldNames: '任务ID,任务名称,状态,优先级,负责人,开始时间,截止时间,进度,所属项目,是否阻塞,阻塞原因,风险等级,里程碑',
      filterProject: query.filterProject,
      filterStatus: query.filterStatus,
      filterAssignee: query.filterAssignee,
      filterRisk: query.filterRisk
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseItems = (records.items || [])
      .map((record: any) => {
        const fields = (record?.fields || {}) as Record<string, unknown>;
        const start = this.parseDate(fields['开始时间']);
        const end = this.parseDate(fields['截止时间']);
        const progress = this.parseProgress(fields['进度']);
        const milestone = String(fields['里程碑'] ?? '否');
        const daysLeft = end ? Math.ceil((end.getTime() - today.getTime()) / DAY_MS) : null;

        return {
          recordId: String(record.record_id ?? ''),
          taskId: String(fields['任务ID'] ?? ''),
          taskName: String(fields['任务名称'] ?? ''),
          status: String(fields['状态'] ?? ''),
          priority: String(fields['优先级'] ?? ''),
          assignee: this.extractAssignee(fields['负责人']),
          project: String(fields['所属项目'] ?? ''),
          startDate: this.formatDate(start),
          endDate: this.formatDate(end),
          progress,
          daysLeft,
          blocked: String(fields['是否阻塞'] ?? ''),
          blockedReason: String(fields['阻塞原因'] ?? ''),
          riskLevel: String(fields['风险等级'] ?? ''),
          milestone
        };
      })
      .filter((item) => !deadlineRule.includeMilestones ? item.milestone !== '是' : true);

    const items = baseItems
      .map((item) => ({
        ...item,
        overdue: item.daysLeft !== null && item.daysLeft < 0
      }))
      .filter((item) => {
        const deadlineMatch = deadlineRule.enabled && item.daysLeft !== null && item.daysLeft <= deadlineRule.thresholdDays && item.progress < deadlineRule.progressThreshold;
        const blockedMatch = blockedRule.enabled && (item.blocked === (blockedRule.blockedValue || '是'));
        const overdueMatch = overdueRule.enabled && item.daysLeft !== null && item.daysLeft < 0;
        return deadlineMatch || blockedMatch || overdueMatch;
      })
      .map((item) => ({
        ...item,
        ruleMatched: true
      }));

    return {
      generatedAt: new Date().toISOString(),
      rules: [
        {
          id: deadlineRule.key,
          name: deadlineRule.name,
          description: `截止日期 ≤ ${deadlineRule.thresholdDays} 天 且 进度 < ${deadlineRule.progressThreshold}%`,
          thresholdDays: deadlineRule.thresholdDays,
          progressThreshold: deadlineRule.progressThreshold
        },
        {
          id: blockedRule.key,
          name: blockedRule.name,
          description: `是否阻塞 = ${blockedRule.blockedValue || '是'}`,
          thresholdDays: 0,
          progressThreshold: 0
        },
        {
          id: overdueRule.key,
          name: overdueRule.name,
          description: '截止日期已过期',
          thresholdDays: 0,
          progressThreshold: 0
        }
      ],
      count: items.length,
      items
    };
  }

  async listRuleLogs() {
    return this.prisma.riskRuleLog.findMany({
      orderBy: { id: 'desc' },
      take: 200
    });
  }

  private async syncNotifications(
    ruleId: number,
    items: Array<{
      recordId: string;
      taskId: string;
      taskName: string;
      project: string;
      endDate: string | null;
      progress: number;
      daysLeft: number | null;
      riskLevel: string;
      blocked: string;
      blockedReason: string;
    }>
  ) {
    const existing = await this.prisma.riskAlert.findMany({
      where: { ruleId, recordId: { in: items.map((item) => item.recordId) } }
    });
    const existingSet = new Set(existing.map((row) => row.recordId));

    const projectNames = Array.from(new Set(items.map((item) => item.project).filter(Boolean)));
    const projects = await this.prisma.project.findMany({
      where: { name: { in: projectNames } }
    });
    const projectMap = new Map(projects.map((project) => [project.name, project.id]));

    const toCreate = items.filter((item) => !existingSet.has(item.recordId));
    for (const item of toCreate) {
      await this.prisma.riskAlert.create({
        data: {
          ruleId,
          recordId: item.recordId,
          taskId: item.taskId || null,
          taskName: item.taskName || null,
          project: item.project || null,
          endDate: item.endDate || null,
          progress: item.progress,
          daysLeft: item.daysLeft ?? null
        }
      });

      const projectId = item.project ? projectMap.get(item.project) : undefined;
      const title = `延期风险：${item.taskName || item.taskId || item.recordId}`;
      const messageParts = [
        item.project ? `项目：${item.project}` : null,
        item.endDate ? `截止：${item.endDate}` : null,
        item.daysLeft !== null ? `剩余：${item.daysLeft}天` : null,
        `进度：${item.progress.toFixed(0)}%`,
        item.riskLevel ? `风险：${item.riskLevel}` : null,
        item.blocked ? `阻塞：${item.blocked}` : null,
        item.blockedReason ? `原因：${item.blockedReason}` : null
      ].filter(Boolean);

      await this.notifications.createSystemNotification({
        projectId,
        level: NotificationLevel.warning,
        title,
        message: messageParts.join('｜')
      });
    }
  }
}
