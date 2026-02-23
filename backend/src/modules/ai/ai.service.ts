import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '../config/config.service';

interface WeeklyReportInput {
  projectIds: number[];
  weekStart: string;
  weekEnd: string;
  includeRisks: boolean;
  includeBudget: boolean;
}

interface ProgressReportInput {
  projectId: number;
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) { }

  async weeklyReport(input: WeeklyReportInput) {
    const [projects, requirements, costs, tasks, worklogs] = await Promise.all([
      this.prisma.project.findMany({
        where: { id: { in: input.projectIds } },
        orderBy: { id: 'asc' }
      }),
      this.prisma.requirement.findMany({
        where: { projectId: { in: input.projectIds } }
      }),
      this.prisma.costEntry.findMany({
        where: { projectId: { in: input.projectIds } }
      }),
      this.prisma.task.findMany({
        where: { projectId: { in: input.projectIds } }
      }),
      this.prisma.worklog.findMany({
        where: { projectId: { in: input.projectIds } }
      })
    ]);

    const details = projects.map((project) => {
      const projectRequirements = requirements.filter((item) => item.projectId === project.id);
      const projectCosts = costs.filter((item) => item.projectId === project.id);
      const projectTasks = tasks.filter((item) => item.projectId === project.id);
      const projectWorklogs = worklogs.filter((item) => item.projectId === project.id);
      const blocked = projectTasks.filter((item) => item.status === TaskStatus.blocked).length;
      const worklogLaborCost = projectWorklogs.reduce((sum, item) => sum + item.hours * item.hourlyRate, 0);
      const actualCost = projectCosts.reduce((sum, item) => sum + item.amount, 0) + worklogLaborCost;
      const budgetRate = project.budget === 0 ? 0 : Number((((actualCost - project.budget) / project.budget) * 100).toFixed(2));

      return {
        projectId: project.id,
        projectName: project.name,
        requirementChanges: projectRequirements.reduce((sum, item) => sum + item.changeCount, 0),
        blockedTasks: blocked,
        budgetVarianceRate: budgetRate
      };
    });

    const riskLines = details
      .map((item) => {
        if (item.blockedTasks > 0 || item.budgetVarianceRate > 10 || item.requirementChanges > 3) {
          return `- ${item.projectName}：阻塞=${item.blockedTasks}，预算偏差=${item.budgetVarianceRate}%，需求变更=${item.requirementChanges}`;
        }
        return `- ${item.projectName}：整体稳定。`;
      })
      .join('\n');

    const projectNames = details.map(d => d.projectName).join('、');
    const draft = [
      `${projectNames} 周报草稿（${input.weekStart} 至 ${input.weekEnd}）`,
      '',
      '1）整体概览',
      `本周共跟踪 ${details.length} 个项目。`,
      '',
      '2）关键风险',
      input.includeRisks ? riskLines : '- 已关闭风险段落。',
      '',
      '3）预算概览',
      input.includeBudget
        ? details.map((item) => `- ${item.projectName}：预算偏差 ${item.budgetVarianceRate}%`).join('\n')
        : '- 已关闭预算段落。',
      '',
      '4）下周重点',
      '- 清理关键路径上的阻塞任务。',
      '- 高频变更需求进入评审闸口。',
      '- 高风险项目每 2 天跟踪预算偏差。'
    ].join('\n');

    // 尝试调用 AI 模型
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    if (aiApiUrl && aiApiKey && aiModel) {
      try {
        // 构建 AI 提示词上下文
        const systemPrompt = `你是一位企业级的 PMO 和高管助理。你需要基于提供的多项目或单项目周度数据汇总，生成一份供管理层阅读的《${projectNames} 周报草稿》。
要求：
1. 语言精炼专业，适合向上汇报。
2. 包含“整体概览”、“风险预警（阻塞任务/预算超支/频繁变更）”、“管理层建议与下周重点”。
3. 突出关键数据的异常点，忽略正常指标。`;

        const userPrompt = `报告周期：${input.weekStart} 至 ${input.weekEnd}
涉及项目数：${details.length} 个
包含风险分析：${input.includeRisks ? '是' : '否'}
包含预算分析：${input.includeBudget ? '是' : '否'}

各项目关键指标数据：
${JSON.stringify(details, null, 2)}`;

        const aiReport = await this.callAiModel(aiApiUrl, aiApiKey, aiModel, systemPrompt, userPrompt);

        return {
          generatedAt: new Date().toISOString(),
          evidence: details,
          source: 'ai',
          report: aiReport
        };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return {
          generatedAt: new Date().toISOString(),
          evidence: details,
          source: 'template',
          error: `AI 模型调用失败（${detail}），已生成模板周报草稿。`,
          report: `⚠ AI 模型调用失败：${detail}\n⚠ 以下为模板生成的草稿，请到「系统配置」检查 AI 配置。\n\n${draft}`
        };
      }
    }

    // 无配置，回退到模板
    return {
      generatedAt: new Date().toISOString(),
      evidence: details,
      source: 'template',
      hint: '未配置 AI 模型，当前为模板草稿。可在「系统配置」中设置 AI 密钥以启用 AI 智能总结。',
      report: `💡 提示：未配置 AI 模型，当前为死板的字符串拼接草稿。前往「系统配置 → AI 模型配置」填写端点和密钥即可启用智能总结与汇报建议。\n\n${draft}`
    };
  }

  /** 生成项目进展分析报告（接入 AI 模型） */
  async progressReport(input: ProgressReportInput) {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      include: { owner: true }
    });
    if (!project) {
      return { report: '未找到该项目。' };
    }

    // 并行查询所有指标数据
    const [requirements, costs, tasks, worklogs, milestones] = await Promise.all([
      this.prisma.requirement.findMany({ where: { projectId: input.projectId } }),
      this.prisma.costEntry.findMany({ where: { projectId: input.projectId } }),
      this.prisma.task.findMany({ where: { projectId: input.projectId } }),
      this.prisma.worklog.findMany({ where: { projectId: input.projectId } }),
      this.prisma.milestone.findMany({ where: { projectId: input.projectId } }),
    ]);

    // ======= 计算指标 =======
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === TaskStatus.done).length;
    const inProgressTasks = tasks.filter((t) => t.status === TaskStatus.in_progress).length;
    const blockedTasks = tasks.filter((t) => t.status === TaskStatus.blocked).length;
    const todoTasks = tasks.filter((t) => t.status === TaskStatus.todo).length;
    const taskCompletionRate = totalTasks > 0 ? ((doneTasks / totalTasks) * 100).toFixed(1) : '0';

    const totalReqs = requirements.length;
    const approvedReqs = requirements.filter((r) => r.status === 'approved' || r.status === 'done').length;
    const draftReqs = requirements.filter((r) => r.status === 'draft').length;
    const reviewReqs = requirements.filter((r) => r.status === 'in_review').length;
    const totalChanges = requirements.reduce((sum, r) => sum + r.changeCount, 0);
    const highPriorityReqs = requirements.filter((r) => r.priority === 'high').length;

    const budget = project.budget;
    const directCost = costs.reduce((sum, c) => sum + c.amount, 0);
    const laborCost = worklogs.reduce((sum, w) => sum + w.hours * w.hourlyRate, 0);
    const totalHours = worklogs.reduce((sum, w) => sum + w.hours, 0);
    const actualCost = directCost + laborCost;
    const budgetVariance = budget > 0 ? (((actualCost - budget) / budget) * 100).toFixed(1) : '0';
    const budgetRemaining = budget - actualCost;

    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter((m) => m.actualDate).length;
    const overdueMilestones = milestones.filter((m) => !m.actualDate && new Date(m.plannedDate) < new Date()).length;

    // 时间进度
    let timeProgress = '未设置';
    let remainingDays = 0;
    if (project.startDate && project.endDate) {
      const start = new Date(project.startDate);
      const end = new Date(project.endDate);
      const now = new Date();
      const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
      const elapsed = Math.max(0, (now.getTime() - start.getTime()) / 86400000);
      timeProgress = Math.min(100, (elapsed / totalDays) * 100).toFixed(1) + '%';
      remainingDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
    }

    // 组装项目数据摘要（供 AI 分析）
    const projectDataSummary = [
      `项目名称：${project.name}`,
      `项目负责人：${project.owner?.name ?? '未指定'}`,
      `起止时间：${project.startDate ?? '未设置'} → ${project.endDate ?? '未设置'}`,
      `时间进度：${timeProgress}，剩余 ${remainingDays} 天`,
      '',
      `【任务】总数 = ${totalTasks}，已完成 = ${doneTasks}（${taskCompletionRate} %），进行中 = ${inProgressTasks}，待办 = ${todoTasks}，阻塞 = ${blockedTasks}`,
      `【需求】总数 = ${totalReqs}，已批准 = ${approvedReqs}，评审中 = ${reviewReqs}，草稿 = ${draftReqs}，高优先级 = ${highPriorityReqs}，累计变更 = ${totalChanges}次`,
      `【预算】总预算 =¥${budget}，实际支出 =¥${actualCost}（直接成本¥${directCost} + 人力成本¥${laborCost}），偏差 = ${budgetVariance} %，剩余 =¥${budgetRemaining}`,
      `【工时】总工时 = ${totalHours.toFixed(1)}小时`,
      `【里程碑】总计 = ${totalMilestones}，已完成 = ${completedMilestones}，逾期 = ${overdueMilestones}`,
      ...milestones.map((m) => `  · ${m.name}：计划 ${m.plannedDate}${m.actualDate ? `，实际 ${m.actualDate}` : new Date(m.plannedDate) < new Date() ? '（已逾期）' : '（待完成）'}`),
      '',
      `【任务明细】`,
      ...tasks.map((t) => `  ·[${t.status}] ${t.title}，负责人 = ${t.assignee}，计划 ${t.plannedStart}→${t.plannedEnd}`),
      '',
      `【需求明细】`,
      ...requirements.map((r) => `  ·[${r.status} / ${r.priority}] ${r.title}，变更${r.changeCount}次`),
    ].join('\n');

    // 尝试调用 AI 模型
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    if (aiApiUrl && aiApiKey && aiModel) {
      // 有 AI 配置，调用真实 AI 模型
      try {
        const systemPrompt = `你是一位资深的项目管理专家和数据分析师。你将根据以下项目数据生成一份结构清晰、分析深入的项目进展情况报告。

          报告要求：
          1. 使用中文，语气专业严谨
2. 包含以下章节：项目概况、进度分析、预算分析、需求管理、风险评估、综合建议
3. 对数据进行深入分析，指出关键问题和潜在风险
4. 给出具体、可操作的改进建议
5. 结论部分给出项目整体健康评级和未来展望
6. 使用清晰的分隔线和层次结构
7. 报告长度约 500 - 800 字`;

        const userPrompt = `请基于以下项目实际数据，生成一份项目进展分析报告：\n\n${projectDataSummary}`;

        const aiReport = await this.callAiModel(aiApiUrl, aiApiKey, aiModel, systemPrompt, userPrompt);
        return {
          generatedAt: new Date().toISOString(),
          projectName: project.name,
          source: 'ai',
          report: aiReport
        };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        // AI 调用失败，回退到模板报告并附加错误提示
        const fallbackReport = this.buildTemplateReport(project, projectDataSummary, {
          totalTasks, doneTasks, inProgressTasks, blockedTasks, todoTasks, taskCompletionRate,
          totalReqs, approvedReqs, draftReqs, reviewReqs, totalChanges, highPriorityReqs,
          budget, actualCost, directCost, laborCost, totalHours, budgetVariance, budgetRemaining,
          totalMilestones, completedMilestones, overdueMilestones, milestones, timeProgress, remainingDays,
        });
        return {
          generatedAt: new Date().toISOString(),
          projectName: project.name,
          source: 'template',
          error: `AI 模型调用失败（${detail}），已生成模板报告。请检查系统配置中的 AI 模型设置。`,
          report: `⚠ AI 模型调用失败：${detail}\n⚠ 以下为模板生成的报告，请到「系统配置」检查 AI 配置。\n\n${fallbackReport}`
        };
      }
    } else {
      // 没有 AI 配置，使用模板报告
      const templateReport = this.buildTemplateReport(project, projectDataSummary, {
        totalTasks, doneTasks, inProgressTasks, blockedTasks, todoTasks, taskCompletionRate,
        totalReqs, approvedReqs, draftReqs, reviewReqs, totalChanges, highPriorityReqs,
        budget, actualCost, directCost, laborCost, totalHours, budgetVariance, budgetRemaining,
        totalMilestones, completedMilestones, overdueMilestones, milestones, timeProgress, remainingDays,
      });
      return {
        generatedAt: new Date().toISOString(),
        projectName: project.name,
        source: 'template',
        hint: '未配置 AI 模型，当前为模板报告。可在「系统配置」中设置 AI_API_URL、AI_API_KEY、AI_MODEL 以启用 AI 分析。',
        report: `💡 提示：未配置 AI 模型，当前为模板生成。前往「系统配置 → AI 模型配置」填写端点和密钥即可启用 AI 智能分析。\n\n${templateReport}`
      };
    }
  }

  /** 调用 AI 模型（兼容 OpenAI Chat Completions API 格式）*/
  private async callAiModel(apiUrl: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
    // 确保 URL 以 /chat/completions 结尾
    let endpoint = apiUrl.replace(/\/+$/, '');
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint += '/chat/completions';
    }

    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`API 返回 ${response.status}：${errorText.slice(0, 200)}`);
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI 模型返回了空内容');
    }

    return content;
  }

  /** 模板报告（AI 未配置或调用失败时的回退方案） */
  private buildTemplateReport(
    project: { name: string; owner?: { name: string } | null; startDate?: string | null; endDate?: string | null },
    _projectData: string,
    metrics: {
      totalTasks: number; doneTasks: number; inProgressTasks: number; blockedTasks: number; todoTasks: number; taskCompletionRate: string;
      totalReqs: number; approvedReqs: number; draftReqs: number; reviewReqs: number; totalChanges: number; highPriorityReqs: number;
      budget: number; actualCost: number; directCost: number; laborCost: number; totalHours: number; budgetVariance: string; budgetRemaining: number;
      totalMilestones: number; completedMilestones: number; overdueMilestones: number;
      milestones: { name: string; plannedDate: string; actualDate: string | null }[];
      timeProgress: string; remainingDays: number;
    }
  ): string {
    const now = new Date();
    const reportDate = `${now.getFullYear()} - ${String(now.getMonth() + 1).padStart(2, '0')
      }-${String(now.getDate()).padStart(2, '0')} `;

    // 健康度
    let healthScore = 100;
    if (metrics.blockedTasks > 0) healthScore -= metrics.blockedTasks * 10;
    if (Number(metrics.budgetVariance) > 10) healthScore -= 15;
    if (Number(metrics.budgetVariance) > 25) healthScore -= 15;
    if (metrics.totalChanges > 5) healthScore -= 10;
    if (metrics.overdueMilestones > 0) healthScore -= metrics.overdueMilestones * 8;
    healthScore = Math.max(0, Math.min(100, healthScore));
    const healthLevel = healthScore >= 80 ? '🟢 优良' : healthScore >= 60 ? '🟡 一般' : healthScore >= 40 ? '🟠 警告' : '🔴 危险';

    return [
      `═══════════════════════════════════════════`,
      `  项目进展分析报告（模板）`,
      `  生成时间：${reportDate} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} `,
      `═══════════════════════════════════════════`,
      '',
      `【项目基本信息】`,
      `  项目名称：${project.name} `,
      `  项目负责人：${project.owner?.name ?? '未指定'} `,
      `  起止时间：${project.startDate ?? '未设置'} → ${project.endDate ?? '未设置'} `,
      `  时间进度：${metrics.timeProgress}，剩余 ${metrics.remainingDays} 天`,
      '',
      `【综合健康度】`,
      `  评分：${healthScore} 分（${healthLevel}）`,
      '',
      `【任务执行情况】`,
      `  总数：${metrics.totalTasks}｜完成：${metrics.doneTasks}（${metrics.taskCompletionRate}%）｜进行中：${metrics.inProgressTasks}｜阻塞：${metrics.blockedTasks} `,
      '',
      `【需求状态】`,
      `  总计：${metrics.totalReqs}｜已批准：${metrics.approvedReqs}｜评审中：${metrics.reviewReqs}｜变更：${metrics.totalChanges} 次`,
      '',
      `【预算与成本】`,
      `  总预算：¥${metrics.budget.toLocaleString()}｜实际：¥${metrics.actualCost.toLocaleString()}｜偏差：${metrics.budgetVariance}%｜剩余：¥${metrics.budgetRemaining.toLocaleString()} `,
      '',
      `【里程碑】`,
      `  总计：${metrics.totalMilestones}，已完成：${metrics.completedMilestones}，逾期：${metrics.overdueMilestones} `,
      ...metrics.milestones.map((m) => `  · ${m.name}：${m.actualDate ? `✓ ${m.actualDate}` : new Date(m.plannedDate) < new Date() ? `✕ 逾期` : `○ ${m.plannedDate}`} `),
      '',
      `═══════════════════════════════════════════`,
      `  天枢管控矩阵 · 模板报告引擎`,
      `═══════════════════════════════════════════`,
    ].join('\n');
  }
}
