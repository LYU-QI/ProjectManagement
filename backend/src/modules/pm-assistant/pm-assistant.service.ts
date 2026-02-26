import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { FeishuService } from '../feishu/feishu.service';
import { PrismaService } from '../../database/prisma.service';
import type { PmAssistantLog, PmAssistantJobConfig } from '@prisma/client';
import type { FeishuTaskRecord, PmJobId, PmJobMeta, PmRunLog, PmRunResult } from './pm-assistant.types';

const JOBS: PmJobMeta[] = [
  { id: 'morning-briefing', name: '早间播报', color: 'blue', description: '今日工作重点' },
  { id: 'meeting-materials', name: '会议材料准备', color: 'blue', description: '站会材料整理' },
  { id: 'risk-alerts', name: '风险预警', color: 'orange', description: '高风险任务预警' },
  { id: 'overdue-reminder', name: '超期任务提醒', color: 'red', description: '超期任务分级提醒' },
  { id: 'milestone-reminder', name: '里程碑提醒', color: 'orange', description: '里程碑预警/庆祝' },
  { id: 'blocked-alert', name: '阻塞任务预警', color: 'red', description: '阻塞任务清单' },
  { id: 'resource-load', name: '资源负载分析', color: 'blue', description: '成员负载指数' },
  { id: 'progress-board', name: '进度看板', color: 'green', description: '项目进度统计' },
  { id: 'trend-predict', name: '任务趋势预测', color: 'blue', description: '进度滞后预测' },
  { id: 'weekly-agenda', name: '周会讨论要点', color: 'blue', description: '周会议程' },
  { id: 'daily-report', name: '晚间日报', color: 'green', description: '今日总结+亮点' },
  { id: 'weekly-report', name: '周报', color: 'purple', description: '本周工作总结' }
];

const FIELD = {
  title: '任务名称',
  status: '状态',
  priority: '优先级',
  assignee: '负责人',
  start: '开始时间',
  end: '截止时间',
  progress: '进度',
  project: '所属项目',
  blocked: '是否阻塞',
  blockReason: '阻塞原因',
  risk: '风险等级',
  milestone: '里程碑'
};

@Injectable()
export class PmAssistantService {
  private readonly logger = new Logger(PmAssistantService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly feishuService: FeishuService
  ) {}

  listJobs(): PmJobMeta[] {
    return JOBS;
  }

  async getLogs(limit = 100): Promise<PmRunLog[]> {
    const rows = await this.prisma.pmAssistantLog.findMany({
      take: Math.min(limit, 200),
      orderBy: { createdAt: 'desc' }
    });
    return rows.map((row: PmAssistantLog) => ({
      id: String(row.id),
      jobId: row.jobId as PmJobId,
      triggeredBy: row.triggeredBy as 'manual' | 'schedule',
      status: row.status as 'success' | 'failed' | 'dry-run' | 'skipped',
      summary: row.summary,
      rawSummary: row.rawSummary || undefined,
      aiSummary: row.aiSummary || undefined,
      error: row.error || undefined,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async getJobConfigs() {
    const existing = await this.prisma.pmAssistantJobConfig.findMany();
    const existingMap = new Map(existing.map((item: PmAssistantJobConfig) => [item.jobId, item]));
    const missing = JOBS.filter((job) => !existingMap.has(job.id)).map((job) => ({
      jobId: job.id,
      enabled: true
    }));
    if (missing.length > 0) {
      await this.prisma.pmAssistantJobConfig.createMany({ data: missing });
    }
    const rows = await this.prisma.pmAssistantJobConfig.findMany({ orderBy: { jobId: 'asc' } });
    return rows.map((row: PmAssistantJobConfig) => ({
      jobId: row.jobId,
      enabled: row.enabled
    }));
  }

  async updateJobConfig(jobId: PmJobId, enabled: boolean) {
    await this.prisma.pmAssistantJobConfig.upsert({
      where: { jobId },
      update: { enabled },
      create: { jobId, enabled }
    });
    return { success: true };
  }

  async runJob(
    jobId: PmJobId,
    opts?: { dryRun?: boolean; receiveId?: string; receiveIds?: string[]; projectId?: number; triggeredBy?: 'manual' | 'schedule' }
  ): Promise<PmRunResult> {
    const job = this.getJob(jobId);
    const triggeredBy = opts?.triggeredBy ?? 'manual';
    const config = await this.prisma.pmAssistantJobConfig.findUnique({ where: { jobId } });
    if (config && !config.enabled) {
      await this.pushLog({
        jobId,
        triggeredBy,
        status: 'skipped',
        summary: `任务已禁用：${job.name}`,
        rawSummary: `任务已禁用：${job.name}`,
        aiSummary: `任务已禁用：${job.name}`
      });
      return { jobId, sent: false, summary: `任务已禁用：${job.name}`, card: {} };
    }
    try {
      const project = opts?.projectId
        ? await this.prisma.project.findUnique({
          where: { id: opts.projectId },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            budget: true,
            owner: { select: { name: true } }
          }
        })
        : null;
      const projectInfo = project ? {
        id: project.id,
        name: project.name,
        ownerName: project.owner?.name || '',
        startDate: project.startDate || '',
        endDate: project.endDate || '',
        budget: project.budget
      } : undefined;
      const { headerTitle, template, summary, mentions, todayStr, aiContext, fallbackMentionText } = await this.buildCard(jobId, projectInfo);
      const summarized = await this.summarizeWithAi(jobId, summary, aiContext);
      let finalText = summarized || summary;
      if (this.shouldMention(jobId) && fallbackMentionText && !finalText.includes('<at id=')) {
        finalText = `${finalText}\n- 负责人：${fallbackMentionText}`;
      }
      const card = this.buildCardPayload(headerTitle, template, finalText, todayStr);

      if (opts?.dryRun) {
        await this.pushLog({
          jobId,
          triggeredBy,
          status: 'dry-run',
          summary: finalText,
          rawSummary: summary,
          aiSummary: summarized
        });
        return { jobId, sent: false, summary: finalText, card };
      }

      const manualIds = opts?.receiveId ? [opts.receiveId] : [];
      let receiveIds = opts?.receiveIds && opts.receiveIds.length > 0
        ? opts.receiveIds
        : manualIds.length > 0
          ? manualIds
          : opts?.projectId
            ? await this.getProjectChatIds(opts.projectId)
            : [];
      if (receiveIds.length === 0) {
        const fallback = this.getDefaultChatId();
        if (fallback) receiveIds = [fallback];
      }
      if (receiveIds.length === 0) {
        throw new BadRequestException('未配置 FEISHU_CHAT_ID，无法发送消息。');
      }

      await Promise.all(receiveIds.map((receiveId) => this.feishuService.sendInteractiveMessage({
        receiveId,
        receiveIdType: 'chat_id',
        card,
        mentions
      })));

      await this.pushLog({
        jobId,
        triggeredBy,
        status: 'success',
        summary: finalText,
        rawSummary: summary,
        aiSummary: summarized
      });
      return { jobId, sent: true, summary: finalText, card };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      await this.pushLog({
        jobId,
        triggeredBy,
        status: 'failed',
        summary: `任务执行失败: ${job.name}`,
        error: detail
      });
      throw err;
    }
  }

  private getDefaultChatId() {
    return this.configService.getRawValue('FEISHU_CHAT_ID');
  }

  private shouldMention(jobId: PmJobId) {
    return new Set<PmJobId>(['blocked-alert', 'overdue-reminder', 'risk-alerts', 'milestone-reminder']).has(jobId);
  }

  private parseChatIds(raw?: string | null) {
    if (!raw) return [];
    return raw
      .split(/[,;\n]/)
      .map((id) => id.trim())
      .filter(Boolean);
  }

  private async getProjectChatIds(projectId: number) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    return this.parseChatIds(project?.feishuChatIds);
  }

  private getJob(jobId: PmJobId) {
    const job = JOBS.find((item) => item.id === jobId);
    if (!job) throw new BadRequestException(`未知任务: ${jobId}`);
    return job;
  }

  private parseDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.valueOf()) ? null : d;
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.valueOf()) ? null : d;
    }
    return null;
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private daysBetween(a: Date, b: Date) {
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / 86400000);
  }

  private asText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    return '';
  }

  private extractUserInfo(value: unknown): Array<{ name: string; openId: string }> {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const name = (item as any).name || (item as any).en_name;
          const openId = (item as any).id;
          if (name && openId) return { name: String(name), openId: String(openId) };
        }
        return null;
      })
      .filter((u): u is { name: string; openId: string } => !!u);
  }

  private async resolveAssignees(value: unknown): Promise<Array<{ name: string; openId: string }>> {
    const direct = this.extractUserInfo(value);
    if (direct.length > 0) return direct;
    if (typeof value !== 'string') return [];
    const names = value
      .split(/[,，、]/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length === 0) return [];
    const users = await this.prisma.feishuUser.findMany({
      where: { name: { in: names } }
    });
    return users.map((u) => ({ name: u.name, openId: u.openId }));
  }

  private getMentions(users: Array<{ name: string; openId: string }>) {
    return users.map((u) => ({ key: u.openId, id: { open_id: u.openId } }));
  }

  private buildMentionText(users: Array<{ name: string; openId: string }>) {
    if (users.length === 0) return '';
    return users.map((u) => `<at id=\"${u.openId}\">${u.name}</at>`).join(' ');
  }

  private async loadFeishuTasks(): Promise<FeishuTaskRecord[]> {
    const data = await this.feishuService.listRecords({
      pageSize: 200,
      fieldNames: Object.values(FIELD).join(',')
    });
    return (data.items || []) as FeishuTaskRecord[];
  }

  private getPromptKey(jobId: PmJobId) {
    return `FEISHU_PM_ASSISTANT_PROMPT_${jobId.toUpperCase().replace(/-/g, '_')}`;
  }

  private async summarizeWithAi(jobId: PmJobId, summary: string, context?: string) {
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');
    if (!aiApiUrl || !aiApiKey || !aiModel) {
      return summary;
    }
    const systemPrompt =
      this.configService.getRawValue(this.getPromptKey(jobId)) ||
      this.getDefaultSystemPrompt(jobId);
    const mentionRule = this.shouldMention(jobId)
      ? '对于涉及任务的要点，必须保留负责人 @ 提及，格式使用 <at id="...">姓名</at>，不要省略。'
      : '';
    const userPrompt = [
      `任务类型：${jobId}`,
      context ? `项目上下文：\n${context}` : '',
      `原始要点：\n${summary}`,
      '请根据项目上下文进行分析与整理，输出 3-5 条简短、结构化要点，每条以「-」开头，避免空话。',
      mentionRule,
      '如果原始要点中包含 <at id="..."> 提及，请原样保留。'
    ].filter(Boolean).join('\n');
    try {
      const res = await fetch(aiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3
        })
      });
      if (!res.ok) {
        return summary;
      }
      const data = await res.json() as any;
      const text = data?.choices?.[0]?.message?.content?.trim();
      return text || summary;
    } catch {
      return summary;
    }
  }

  private getDefaultSystemPrompt(jobId: PmJobId) {
    const base = '你是资深项目管理助理，基于项目现状数据生成简短且结构化的群消息。输出应具体、可执行，不要空话。';
    const map: Record<PmJobId, string> = {
      'morning-briefing': `${base} 输出「概览/重点/下一步」3-5条。`,
      'meeting-materials': `${base} 输出「阻塞/超期/需协同」3-5条。`,
      'risk-alerts': `${base} 输出「风险点/影响/建议动作」3-5条。`,
      'overdue-reminder': `${base} 输出「超期概览/紧急项/处理建议」3-5条。`,
      'milestone-reminder': `${base} 输出「临近里程碑/已完成/准备事项」3-5条。`,
      'blocked-alert': `${base} 输出「阻塞概览/原因/解阻动作」3-5条。`,
      'resource-load': `${base} 输出「负载概览/过载/调配建议」3-5条。`,
      'progress-board': `${base} 输出「进度概览/偏差/下一步」3-5条。`,
      'trend-predict': `${base} 输出「趋势结论/偏差原因/预警等级」3-5条。`,
      'weekly-agenda': `${base} 输出「本周重点/风险&阻塞/需决策事项」3-5条。`,
      'daily-report': `${base} 输出「已完成/未完成阻塞/次日重点」3-5条。`,
      'weekly-report': `${base} 输出「完成概况/风险变化/下周重点」3-5条。`
    };
    return map[jobId] || base;
  }

  private buildCardPayload(title: string, template: 'red' | 'orange' | 'green' | 'blue' | 'purple', contentText: string, todayStr: string) {
    return {
      config: { wide_screen_mode: true },
      header: { title: { tag: 'plain_text', content: title }, template },
      elements: [
        { tag: 'div', text: { tag: 'lark_md', content: contentText } },
        { tag: 'hr' },
        { tag: 'div', text: { tag: 'lark_md', content: `数据时间：${todayStr}` } }
      ]
    };
  }

  getDefaultSystemPrompts() {
    return JOBS.map((job) => ({
      jobId: job.id,
      name: job.name,
      prompt: this.getDefaultSystemPrompt(job.id)
    }));
  }

  private async buildCard(jobId: PmJobId, project?: { id: number; name: string; ownerName?: string; startDate?: string; endDate?: string; budget?: number }) {
    const today = new Date();
    const todayStr = this.formatDate(today);
    const tasks = await this.loadFeishuTasks();

    const normalized = await Promise.all(tasks.map(async (record) => {
      const fields = record.fields || {};
      const assignees = await this.resolveAssignees(fields[FIELD.assignee]);
      const start = this.parseDate(fields[FIELD.start]);
      const end = this.parseDate(fields[FIELD.end]);
      const status = this.asText(fields[FIELD.status]);
      const progressRaw = fields[FIELD.progress];
      const progress = typeof progressRaw === 'number' ? progressRaw : Number(String(progressRaw || '').replace('%', ''));
      const blocked = Array.isArray(fields[FIELD.blocked])
        ? (fields[FIELD.blocked] as Array<unknown>).includes('是')
        : this.asText(fields[FIELD.blocked]) === '是';
      return {
        id: record.id,
        title: this.asText(fields[FIELD.title]) || '未命名任务',
        status,
        priority: this.asText(fields[FIELD.priority]),
        assignees,
        start,
        end,
        progress: Number.isFinite(progress) ? progress : null,
        project: this.asText(fields[FIELD.project]) || '未归属项目',
        blocked,
        blockReason: this.asText(fields[FIELD.blockReason]),
        risk: this.asText(fields[FIELD.risk]),
        milestone: this.asText(fields[FIELD.milestone]) === '是'
      };
    }));

    const projectName = project?.name;
    const scoped = projectName ? normalized.filter((t) => t.project === projectName) : normalized;
    const overdue = scoped.filter((t) => t.end && t.status !== '已完成' && t.end < today);
    const blocked = scoped.filter((t) => t.blocked || t.status === '阻塞');
    const highRisk = scoped.filter((t) => ['高', 'High', 'high'].includes(t.risk));
    const todayTasks = scoped.filter((t) => t.end && this.formatDate(t.end) === todayStr && t.status !== '已完成');
    const upcomingMilestones = scoped.filter((t) => t.milestone && t.end && this.daysBetween(today, t.end) <= 3 && t.status !== '已完成');
    const completedMilestones = scoped.filter((t) => t.milestone && t.status === '已完成');
    const riskAlerts = projectName
      ? await this.prisma.riskAlert.findMany({
        where: { project: projectName },
        orderBy: { notifiedAt: 'desc' },
        take: 10
      })
      : [];

    let title = '';
    let template: 'red' | 'orange' | 'green' | 'blue' | 'purple' = 'blue';
    let lines: string[] = [];
    let mentions: Array<{ key: string; id: { open_id: string } }> = [];
    const mentionUserMap = new Map<string, string>();
    const pushMentions = (users: Array<{ name: string; openId: string }>) => {
      users.forEach((u) => {
        if (u.openId) mentionUserMap.set(u.openId, u.name);
      });
      if (users.length > 0) mentions.push(...this.getMentions(users));
    };

    switch (jobId) {
      case 'morning-briefing':
        title = '早间播报 · 今日重点';
        template = 'blue';
        lines = todayTasks.slice(0, 8).map((t) => `• ${t.title}`);
        if (lines.length === 0) lines = ['今日暂无到期任务，可推进中长期事项。'];
        break;
      case 'meeting-materials':
        title = '站会材料 · 聚焦阻塞与超期';
        template = 'blue';
        lines = [
          `阻塞任务 ${blocked.length} 项，超期任务 ${overdue.length} 项。`,
          ...blocked.slice(0, 5).map((t) => `• ${t.title}${t.blockReason ? `，原因：${t.blockReason}` : ''}`),
          ...overdue.slice(0, 5).map((t) => `• ${t.title} 已超期 ${this.daysBetween(t.end!, today)} 天`)
        ].filter(Boolean);
        break;
      case 'risk-alerts':
        title = '风险预警 · 重点关注';
        template = 'orange';
        lines = highRisk.slice(0, 8).map((t) => {
          const mentionText = this.buildMentionText(t.assignees);
          if (mentionText) pushMentions(t.assignees);
          return `• ${t.title} 风险等级：${t.risk || '高'} ${mentionText}`.trim();
        });
        if (lines.length === 0) lines = ['暂无高风险任务，保持监控。'];
        break;
      case 'overdue-reminder':
        title = '超期任务提醒';
        template = 'red';
        lines = overdue.slice(0, 10).map((t) => {
          const days = this.daysBetween(t.end!, today);
          const level = days >= 7 ? '🚨 紧急' : days >= 4 ? '⚠️ 加急' : '⚠️ 提醒';
          const mentionText = this.buildMentionText(t.assignees);
          if (mentionText) pushMentions(t.assignees);
          return `• ${level} ${t.title} 超期 ${days} 天 ${mentionText}`.trim();
        });
        if (lines.length === 0) lines = ['暂无超期任务。'];
        break;
      case 'milestone-reminder':
        title = '里程碑提醒';
        template = upcomingMilestones.length > 0 ? 'orange' : 'green';
        lines = [
          ...upcomingMilestones.map((t) => {
            const mentionText = this.buildMentionText(t.assignees);
            if (mentionText) pushMentions(t.assignees);
            return `• 临近里程碑：${t.title} 截止 ${this.formatDate(t.end!)} ${mentionText}`.trim();
          }),
          ...completedMilestones.slice(0, 5).map((t) => {
            const mentionText = this.buildMentionText(t.assignees);
            if (mentionText) pushMentions(t.assignees);
            return `• 🎉 已完成里程碑：${t.title} ${mentionText}`.trim();
          })
        ];
        if (lines.length === 0) lines = ['暂无里程碑提醒。'];
        break;
      case 'blocked-alert':
        title = '阻塞任务预警';
        template = 'red';
        lines = blocked.slice(0, 10).map((t) => {
          const mentionText = this.buildMentionText(t.assignees);
          if (mentionText) pushMentions(t.assignees);
          return `• ${t.title}${t.blockReason ? `｜${t.blockReason}` : ''} ${mentionText}`.trim();
        });
        if (lines.length === 0) lines = ['暂无阻塞任务。'];
        break;
      case 'resource-load': {
        title = '资源负载分析';
        template = 'blue';
        const loadMap = new Map<string, { name: string; load: number; overdue: number; todo: number; doing: number }>();
        scoped.forEach((t) => {
          const names = t.assignees.length > 0 ? t.assignees.map((u) => u.name) : ['未指派'];
          const isOverdue = t.end && t.end < today && t.status !== '已完成';
          const isTodo = t.status === '待办';
          const isDoing = t.status === '进行中';
          names.forEach((name) => {
            const curr = loadMap.get(name) || { name, load: 0, overdue: 0, todo: 0, doing: 0 };
            if (isOverdue) curr.overdue += 1;
            if (isTodo) curr.todo += 1;
            if (isDoing) curr.doing += 1;
            curr.load = curr.doing + curr.todo * 0.5 + curr.overdue * 2;
            loadMap.set(name, curr);
          });
        });
        const rows = Array.from(loadMap.values()).sort((a, b) => b.load - a.load).slice(0, 8);
        lines = rows.map((r) => {
          const level = r.load > 5 ? '过载' : r.load < 2 ? '空闲' : '正常';
          return `• ${r.name} 负载指数 ${r.load.toFixed(1)}（${level}）`;
        });
        if (lines.length === 0) lines = ['暂无可用负载数据。'];
        break;
      }
      case 'progress-board': {
        title = '进度看板';
        template = 'green';
        const total = scoped.length;
        const done = scoped.filter((t) => t.status === '已完成').length;
        const doing = scoped.filter((t) => t.status === '进行中').length;
        const todo = scoped.filter((t) => t.status === '待办').length;
        const blockedCount = scoped.filter((t) => t.status === '阻塞' || t.blocked).length;
        const rate = total > 0 ? ((done / total) * 100).toFixed(1) : '0';
        lines = [
          `任务总数 ${total}，完成 ${done}（完成率 ${rate}%）`,
          `进行中 ${doing}，待办 ${todo}，阻塞 ${blockedCount}`
        ];
        break;
      }
      case 'trend-predict': {
        title = '任务趋势预测';
        template = 'blue';
        const deviations = scoped
          .map((t) => {
            if (!t.start || !t.end || t.progress === null) return null;
            const totalDays = Math.max(1, this.daysBetween(t.start, t.end));
            const elapsed = Math.max(0, this.daysBetween(t.start, today));
            const expected = Math.min(1, elapsed / totalDays) * 100;
            const actual = t.progress > 1 ? t.progress : t.progress * 100;
            return { title: t.title, project: t.project, deviation: actual - expected };
          })
          .filter((v): v is { title: string; project: string; deviation: number } => !!v)
          .sort((a, b) => a.deviation - b.deviation)
          .slice(0, 6);
        lines = deviations.map((d) => {
          const level = d.deviation < -20 ? '🚨 严重滞后' : d.deviation < -10 ? '⚠️ 轻微滞后' : '✅ 正常';
          return `• ${d.title} ${level}，偏差 ${d.deviation.toFixed(1)}%`;
        });
        if (lines.length === 0) lines = ['暂无可预测的进度数据。'];
        break;
      }
      case 'weekly-agenda':
        title = '周会讨论要点';
        template = 'blue';
        lines = [
          `阻塞任务 ${blocked.length} 项`,
          `超期任务 ${overdue.length} 项`,
          '高风险事项请逐项确认责任人与解决时间'
        ];
        break;
      case 'daily-report': {
        title = '晚间日报';
        template = 'green';
        const doneToday = scoped.filter((t) => t.status === '已完成' && t.end && this.formatDate(t.end) === todayStr);
        lines = doneToday.slice(0, 8).map((t) => `• ${t.title} 已完成`);
        if (lines.length === 0) lines = ['今日暂无已完成任务，建议复盘阻塞与推进重点。'];
        break;
      }
      case 'weekly-report': {
        title = '周报摘要';
        template = 'purple';
        const total = scoped.length;
        const done = scoped.filter((t) => t.status === '已完成').length;
        const blockedCount = scoped.filter((t) => t.status === '阻塞' || t.blocked).length;
        lines = [
          `本周任务总数 ${total}，完成 ${done}，阻塞 ${blockedCount}`,
          `超期任务 ${overdue.length} 项，高风险 ${highRisk.length} 项`
        ];
        break;
      }
      default:
        throw new BadRequestException(`未实现任务: ${jobId}`);
    }

    const contentText = lines.length > 0 ? lines.join('\n') : '暂无内容。';
    if (!this.shouldMention(jobId)) {
      mentions = [];
    } else if (mentions.length > 1) {
      const uniq = new Map(mentions.map((m) => [m.key, m]));
      mentions = Array.from(uniq.values());
    }
    const fallbackMentionText = this.shouldMention(jobId) && mentionUserMap.size > 0
      ? Array.from(mentionUserMap.entries())
        .map(([id, name]) => `<at id="${id}">${name}</at>`)
        .join(' ')
      : '';
    const headerTitle = projectName ? `${projectName}·${title}` : title;
    const aiContext = this.buildAiContext({
      jobId,
      todayStr,
      project,
      scoped,
      overdue,
      blocked,
      highRisk,
      upcomingMilestones,
      completedMilestones,
      riskAlerts
    });

    return { headerTitle, template, summary: contentText, mentions, todayStr, aiContext, fallbackMentionText };
  }

  private buildAiContext(input: {
    jobId: PmJobId;
    todayStr: string;
    project?: { id: number; name: string; ownerName?: string; startDate?: string; endDate?: string; budget?: number };
    scoped: Array<{ title: string; status: string; assignees: Array<{ name: string; openId: string }>; start: Date | null; end: Date | null; progress: number | null; project: string; blocked: boolean; blockReason: string; risk: string; milestone: boolean }>;
    overdue: Array<{ title: string; assignees: Array<{ name: string; openId: string }>; end: Date | null; blockReason: string }>;
    blocked: Array<{ title: string; assignees: Array<{ name: string; openId: string }>; blockReason: string }>;
    highRisk: Array<{ title: string; assignees: Array<{ name: string; openId: string }>; risk: string }>;
    upcomingMilestones: Array<{ title: string; end: Date | null; assignees: Array<{ name: string; openId: string }> }>;
    completedMilestones: Array<{ title: string; assignees: Array<{ name: string; openId: string }> }>;
    riskAlerts: Array<{ taskName: string | null; project: string | null; endDate: string | null; progress: number | null; daysLeft: number | null }>;
  }) {
    const { project, scoped, overdue, blocked, highRisk, upcomingMilestones, completedMilestones, riskAlerts, todayStr } = input;
    const total = scoped.length;
    const done = scoped.filter((t) => t.status === '已完成').length;
    const doing = scoped.filter((t) => t.status === '进行中').length;
    const todo = scoped.filter((t) => t.status === '待办').length;
    const blockedCount = blocked.length;
    const overdueCount = overdue.length;
    const highRiskCount = highRisk.length;

    const formatAssignee = (users: Array<{ name: string }>) => {
      if (users.length === 0) return '';
      return users.map((u) => u.name).filter(Boolean).join('、');
    };

    const lines: string[] = [];
    lines.push(`日期：${todayStr}`);
    if (project) {
      lines.push(`项目：${project.name}`);
      if (project.ownerName) lines.push(`负责人：${project.ownerName}`);
      if (project.startDate || project.endDate) lines.push(`周期：${project.startDate || '-'} ~ ${project.endDate || '-'}`);
      if (Number.isFinite(project.budget)) lines.push(`预算：${project.budget}`);
    }

    lines.push(`任务概览：总数${total}，进行中${doing}，待办${todo}，完成${done}，阻塞${blockedCount}，超期${overdueCount}，高风险${highRiskCount}`);

    if (blocked.length > 0) {
      const items = blocked.slice(0, 6).map((t) => {
        const mentionText = this.buildMentionText(t.assignees);
        const assigneeText = formatAssignee(t.assignees);
        return `- ${t.title}${t.blockReason ? `｜${t.blockReason}` : ''}${assigneeText ? `（负责人：${assigneeText}）` : ''}${mentionText ? ` ${mentionText}` : ''}`;
      });
      lines.push('阻塞任务：');
      lines.push(...items);
    }

    if (overdue.length > 0) {
      const items = overdue.slice(0, 6).map((t) => {
        const mentionText = this.buildMentionText(t.assignees);
        const assigneeText = formatAssignee(t.assignees);
        return `- ${t.title}${t.end ? `（截止：${this.formatDate(t.end)}）` : ''}${assigneeText ? `（负责人：${assigneeText}）` : ''}${mentionText ? ` ${mentionText}` : ''}`;
      });
      lines.push('超期任务：');
      lines.push(...items);
    }

    if (highRisk.length > 0) {
      const items = highRisk.slice(0, 6).map((t) => {
        const mentionText = this.buildMentionText(t.assignees);
        const assigneeText = formatAssignee(t.assignees);
        return `- ${t.title}${t.risk ? `（风险：${t.risk}）` : ''}${assigneeText ? `（负责人：${assigneeText}）` : ''}${mentionText ? ` ${mentionText}` : ''}`;
      });
      lines.push('高风险任务：');
      lines.push(...items);
    }

    if (upcomingMilestones.length > 0) {
      const items = upcomingMilestones.slice(0, 5).map((t) => {
        const mentionText = this.buildMentionText(t.assignees);
        const assigneeText = formatAssignee(t.assignees);
        return `- ${t.title}${t.end ? `（截止：${this.formatDate(t.end)}）` : ''}${assigneeText ? `（负责人：${assigneeText}）` : ''}${mentionText ? ` ${mentionText}` : ''}`;
      });
      lines.push('临近里程碑：');
      lines.push(...items);
    }

    if (completedMilestones.length > 0) {
      const items = completedMilestones.slice(0, 5).map((t) => {
        const mentionText = this.buildMentionText(t.assignees);
        const assigneeText = formatAssignee(t.assignees);
        return `- ${t.title}${assigneeText ? `（负责人：${assigneeText}）` : ''}${mentionText ? ` ${mentionText}` : ''}`;
      });
      lines.push('已完成里程碑：');
      lines.push(...items);
    }

    if (riskAlerts.length > 0) {
      const items = riskAlerts.slice(0, 6).map((r) => `- ${r.taskName || '未命名'}${r.endDate ? `（截止：${r.endDate}）` : ''}${r.daysLeft !== null && r.daysLeft !== undefined ? `（剩余${r.daysLeft}天）` : ''}`);
      lines.push('系统风险告警：');
      lines.push(...items);
    }

    return lines.join('\n');
  }

  private async pushLog(input: {
    jobId: PmJobId;
    triggeredBy: 'manual' | 'schedule';
    status: 'success' | 'failed' | 'dry-run' | 'skipped';
    summary: string;
    rawSummary?: string;
    aiSummary?: string;
    error?: string;
  }) {
    try {
      await this.prisma.pmAssistantLog.create({
        data: {
          jobId: input.jobId,
          triggeredBy: input.triggeredBy,
          status: input.status,
          summary: input.summary,
          rawSummary: input.rawSummary,
          aiSummary: input.aiSummary,
          error: input.error
        }
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(`写入执行日志失败: ${detail}`);
    }
  }

  async cleanupLogs(retainDays = 90) {
    const cutoff = new Date(Date.now() - retainDays * 86400000);
    await this.prisma.pmAssistantLog.deleteMany({
      where: { createdAt: { lt: cutoff } }
    });
  }
}
