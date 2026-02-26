import { Injectable, BadRequestException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as mammoth from 'mammoth';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '../config/config.service';
const pdfParseModule = require('pdf-parse');
async function parsePdfBuffer(buffer: Buffer) {
  if (typeof pdfParseModule === 'function') {
    return pdfParseModule(buffer);
  }
  if (pdfParseModule?.default && typeof pdfParseModule.default === 'function') {
    return pdfParseModule.default(buffer);
  }
  if (pdfParseModule?.PDFParse) {
    const parser = new pdfParseModule.PDFParse({ data: buffer });
    const result = await parser.getText();
    if (parser.destroy) {
      await parser.destroy();
    }
    return { text: result?.text || '' };
  }
  throw new Error('pdf-parse module is not callable');
}

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

      // 基础指标
      const totalTasks = projectTasks.length;
      const doneTasks = projectTasks.filter((t) => t.status === TaskStatus.done).length;
      const blockedTasksList = projectTasks.filter((t) => t.status === TaskStatus.blocked);
      const blocked = blockedTasksList.length;
      const taskCompletionRate = totalTasks > 0 ? Number(((doneTasks / totalTasks) * 100).toFixed(1)) : 0;
      const worklogLaborCost = projectWorklogs.reduce((sum, item) => sum + item.hours * item.hourlyRate, 0);
      const actualCost = projectCosts.reduce((sum, item) => sum + item.amount, 0) + worklogLaborCost;
      const budgetRate = project.budget === 0 ? 0 : Number((((actualCost - project.budget) / project.budget) * 100).toFixed(2));

      // 文本明细：阻塞任务标题列表
      const blockedTaskTitles = blockedTasksList.map((t) => t.title);

      // 文本明细：高优先级需求名称
      const highPriorityReqNames = projectRequirements
        .filter((r) => r.priority === 'high')
        .map((r) => r.title);

      // 文本明细：本周工时备注（从 worklog 中提取非空备注）
      const worklogNotes = projectWorklogs
        .map((w) => {
          // 备注来源：taskTitle 字段中组员填写的工作说明
          const parts: string[] = [];
          if (w.taskTitle) parts.push(w.taskTitle);
          if (w.assigneeName) parts.push(`(${w.assigneeName})`);
          return parts.join(' ');
        })
        .filter((note) => note.length > 0);

      return {
        projectId: project.id,
        projectName: project.name,
        totalTasks,
        doneTasks,
        taskCompletionRate,
        requirementChanges: projectRequirements.reduce((sum, item) => sum + item.changeCount, 0),
        blockedTasks: blocked,
        blockedTaskTitles,
        highPriorityReqNames,
        worklogNotes,
        budget: project.budget,
        actualCost,
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
        // 构建增强版 AI 提示词：角色升级为资深 PMO 总监
        const systemPrompt = `你是一位拥有 15 年经验的资深 PMO 总监。你需要基于多项目周度数据（含任务明细、需求明细、工时备注等一手信息），为管理层生成一份深度分析的《${projectNames} 周报》。

核心要求：
1. **语言精炼专业**，适合向 CXO 级别汇报，避免流水账。
2. **深度分析**：不仅复述数据，还要识别"数据背后的异常"。例如：
   - 任务完成率高但预算超支 → 可能存在人效比问题或加班隐患。
   - 阻塞任务集中在某一方向 → 可能存在外部依赖或技术瓶颈。
   - 工时备注中出现"联调失败""接口变更"等关键词 → 暗示跨团队协作风险。
3. **输出格式（Markdown）**：
   ## 📊 本周总览
   ## ⚠️ 风险预警与根因分析
   ## 💰 预算健康度
   ## 🎯 管理层行动建议
   ## 📋 下周重点事项
4. 每个章节需结合具体的任务标题、需求名称或工时备注来佐证分析结论。
5. 行动建议务必具体、可执行，标注建议责任方和时间节点。`;

        // 构建富上下文的用户提示词
        const detailBlocks = details.map((d) => {
          const lines = [
            `### ${d.projectName}`,
            `- 任务：总计 ${d.totalTasks}，已完成 ${d.doneTasks}（完成率 ${d.taskCompletionRate}%），阻塞 ${d.blockedTasks}`,
            `- 需求变更次数：${d.requirementChanges}`,
            `- 预算：总额 ¥${d.budget}，实际支出 ¥${d.actualCost}，偏差 ${d.budgetVarianceRate}%`,
          ];
          if (d.blockedTaskTitles.length > 0) {
            lines.push(`- **阻塞任务标题**：${d.blockedTaskTitles.join('、')}`);
          }
          if (d.highPriorityReqNames.length > 0) {
            lines.push(`- **高优先级需求**：${d.highPriorityReqNames.join('、')}`);
          }
          if (d.worklogNotes.length > 0) {
            lines.push(`- **本周工时备注**：${d.worklogNotes.slice(0, 15).join('；')}`);
          }
          return lines.join('\n');
        }).join('\n\n');

        const userPrompt = `报告周期：${input.weekStart} 至 ${input.weekEnd}
涉及项目数：${details.length} 个
包含风险分析：${input.includeRisks ? '是' : '否'}
包含预算分析：${input.includeBudget ? '是' : '否'}

${detailBlocks}`;

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
  private async callAiModel(
    apiUrl: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    opts?: { timeoutMs?: number }
  ): Promise<string> {
    // 确保 URL 以 /chat/completions 结尾
    let endpoint = apiUrl.replace(/\/+$/, '');
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint += '/chat/completions';
    }

    const timeoutMs = opts?.timeoutMs ?? 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      if (isTimeout) {
        throw new Error(`AI 请求失败 [reason=timeout] endpoint=${endpoint} timeoutMs=${timeoutMs}`);
      }
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`AI 请求失败 [reason=network_error] endpoint=${endpoint} detail=${detail}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`AI 请求失败 [reason=http_status] endpoint=${endpoint} status=${response.status} detail=${errorText.slice(0, 200)}`);
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI 模型返回了空内容');
    }

    return content;
  }

  /** 通用 AI 聊天对话 */
  async chat(input: { message: string, history?: { role: 'user' | 'assistant', content: string }[] }) {
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    if (!aiApiUrl || !aiApiKey || !aiModel) {
      return {
        content: '抱歉，系统尚未配置 AI 模型（AI_API_URL / AI_API_KEY / AI_MODEL），请联系管理员。'
      };
    }

    // 获取实时项目上下文数据 (RAG)
    const [projects, tasks, requirements, costs] = await Promise.all([
      this.prisma.project.findMany({
        select: { id: true, name: true, budget: true, startDate: true, endDate: true }
      }),
      this.prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.requirement.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.costEntry.aggregate({ _sum: { amount: true } })
    ]);

    const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
    const totalActualCost = costs._sum.amount || 0;
    const taskSummary = tasks.map(t => `${t.status}: ${t._count._all}`).join(', ');
    const reqSummary = requirements.map(r => `${r.status}: ${r._count._all}`).join(', ');
    const projectList = projects.map(p => ` - ${p.name} (预算: ¥${p.budget.toLocaleString()}, 周期: ${p.startDate || '未设'} 至 ${p.endDate || '未设'})`).join('\n');

    const dataContext = `
当前系统实时数据摘要：
1. 活跃项目清单：
${projectList}
2. 全局任务分布：${taskSummary || '暂无任务'}
3. 全局需求分布：${reqSummary || '暂无需求'}
4. 整体财务状况：总预算 ¥${totalBudget.toLocaleString()}，实际已支出 ¥${totalActualCost.toLocaleString()}。
`;

    const systemPrompt = `你是一个专业的项目管理助理 Astraea，集成在 AstraeaFlow 项目管理系统中。
你的目标是协助用户高效管理项目、需求、成本和进度。
请保持回复简洁、专业且具有行动导向。

${dataContext}

注意：
- 如果用户询问特定项目的进展，请基于上述数据回答。
- 如果数据中没有提到用户询问的具体细节（如某个任务的具体描述），请如实告知并引导用户前往相应页面查看相关模块。
- 始终以专业助手身份回答。`;

    const userPrompt = input.history && input.history.length > 0
      ? `以下是之前的对话历史：
${input.history.map(h => `${h.role === 'user' ? '用户' : '助理'}: ${h.content}`).join('\n')}

当前的提问：${input.message}`
      : input.message;

    try {
      const content = await this.callAiModel(aiApiUrl, aiApiKey, aiModel, systemPrompt, userPrompt);
      return { content };
    } catch (err) {
      console.error('AI Chat Error:', err);
      return {
        content: `AI 响应失败: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  /** AI 连通性测试 */
  async testConnection() {
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    if (!aiApiUrl || !aiApiKey || !aiModel) {
      return {
        ok: false,
        reason: 'missing_config',
        message: '未配置 AI 模型（AI_API_URL / AI_API_KEY / AI_MODEL）。',
      };
    }

    const start = Date.now();
    try {
      const systemPrompt = '你是一个连通性测试助手，仅需回复 OK。';
      const userPrompt = '请只回复 OK。';
      const timeoutMs = 30000;
      const content = await this.callAiModel(aiApiUrl, aiApiKey, aiModel, systemPrompt, userPrompt, { timeoutMs });
      return {
        ok: true,
        model: aiModel,
        endpoint: aiApiUrl,
        latencyMs: Date.now() - start,
        timeoutMs,
        sample: content?.slice(0, 80) || '',
      };
    } catch (err) {
      const timeoutMs = 30000;
      return {
        ok: false,
        reason: 'request_failed',
        message: err instanceof Error ? err.message : String(err),
        model: aiModel,
        endpoint: aiApiUrl,
        latencyMs: Date.now() - start,
        timeoutMs,
      };
    }
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

  /** 需求智能评审：分析需求质量并给出结构化建议 */
  async reviewRequirement(input: { id: number }) {
    // 查询需求完整信息
    const requirement = await this.prisma.requirement.findUnique({
      where: { id: input.id },
      include: { project: true, changes: { orderBy: { createdAt: 'desc' }, take: 5 } }
    });
    if (!requirement) {
      return { source: 'error', review: '未找到该需求。' };
    }

    // 构建需求上下文给 AI 分析
    const context = [
      `需求标题：${requirement.title}`,
      `需求描述：${requirement.description || '（无描述）'}`,
      `优先级：${requirement.priority}`,
      `当前状态：${requirement.status}`,
      `累计变更次数：${requirement.changeCount}`,
      `所属项目：${requirement.project.name}`,
      requirement.changes.length > 0
        ? `最近变更原因：${requirement.changes.map((c) => c.reason || '（无说明）').join('；')}`
        : '无变更记录',
    ].join('\n');

    // 尝试调用 AI 模型
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    if (aiApiUrl && aiApiKey && aiModel) {
      try {
        const systemPrompt = `你是一名拥有 10 年经验的资深需求分析师（BA）。你的职责是对产品需求进行严格的质量评审，识别潜在缺陷并给出改进建议。

评审维度（必须逐一覆盖）：
1. **完整性**：描述是否清晰、是否包含业务背景和用户价值？
2. **可验证性**：是否有明确的验收标准？能否量化"做到什么程度算完成"？
3. **优先级合理性**：给定的优先级（高/中/低）与描述的业务影响是否匹配？
4. **变更风险**：当前变更次数是否异常？是否存在反复摇摆的迹象？
5. **可拆分性**：该需求是否过于宏观，建议拆分为多个子需求？

输出格式（Markdown）：
## 🔍 需求质量评审报告

### 总体评级
（🟢 高质量 / 🟡 待改进 / 🔴 需重写，一句话综合评价）

### 逐维度分析
（每个维度：[维度名] - 发现的问题 + 具体改进建议）

### 📝 改进建议稿
（如果描述需要改写，直接给出改写建议）`;

        const userPrompt = `请对以下需求进行全面质量评审：\n\n${context}`;
        const review = await this.callAiModel(aiApiUrl, aiApiKey, aiModel, systemPrompt, userPrompt);
        return { source: 'ai', requirementId: input.id, requirementTitle: requirement.title, review };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return {
          source: 'template',
          requirementId: input.id,
          requirementTitle: requirement.title,
          error: `AI 调用失败（${detail}）`,
          review: this.buildTemplateRequirementReview(requirement)
        };
      }
    }

    // 未配置 AI，返回模板评审
    return {
      source: 'template',
      requirementId: input.id,
      requirementTitle: requirement.title,
      hint: '未配置 AI 模型，当前为模板评审。',
      review: this.buildTemplateRequirementReview(requirement)
    };
  }

  /** 模板需求评审（AI 未配置时的回退方案） */
  private buildTemplateRequirementReview(req: {
    title: string; description: string; priority: string; status: string; changeCount: number;
  }): string {
    const issues: string[] = [];
    if (!req.description || req.description.length < 20) issues.push('⚠️ 需求描述过短，缺乏足够的业务背景和用户价值说明。');
    if (req.changeCount >= 3) issues.push(`⚠️ 该需求已变更 ${req.changeCount} 次，存在反复摇摆风险，建议与业务方确认最终方向后再开发。`);
    if (!req.description?.includes('验收') && !req.description?.includes('标准')) issues.push('⚠️ 未发现验收标准，建议补充"做到什么程度算完成"的量化指标。');
    if (req.priority === 'high' && req.status === 'draft') issues.push('⚠️ 高优先级需求仍处于草稿状态，建议加快评审进入 in_review 阶段。');

    return [
      `## 🔍 需求质量评审报告（模板模式）`,
      ``,
      `> 💡 配置 AI 密钥可获得更深度的语义分析评审。`,
      ``,
      `**需求**：${req.title}`,
      `**优先级**：${req.priority} ｜ **状态**：${req.status} ｜ **变更次数**：${req.changeCount}`,
      ``,
      `### 发现的问题`,
      issues.length > 0 ? issues.join('\n') : '✅ 基础检查通过，未发现明显问题。',
    ].join('\n');
  }

  /** 自然语言录入任务：将口语化描述解析为结构化任务字段 */
  async parseTaskFromText(input: { text: string; projectName?: string }) {
    const today = new Date().toISOString().slice(0, 10);

    // 尝试调用 AI 解析
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    if (aiApiUrl && aiApiKey && aiModel) {
      try {
        const systemPrompt = `你是一名项目管理助手，专门从自然语言描述中提取结构化任务信息。

当前日期：${today}（周${new Date().getDay() || 7}）
任务规则：
- 将口语化描述转换为精确的任务字段
- 日期格式统一为 YYYY-MM-DD
- 如果提到"下周X"，基于当前日期合理计算精确的具体日期
- 如果只提到了截止时间（如"前完成"）和工期（如"大概 x 天"）：请优先假设任务「尽快开始」（即今天或明天开始），并据此计算合理的起始时间，只要能满足在截止时间前拥有足够工期即可，**不要机械地从截止时间往前倒推**。
- 如果只提到了开始时间和工期，请根据开始时间往后加算工作日得出合理截止时间。
- 如果某字段无法从描述中确定且无法推算，留空字符串

必须返回合法的 JSON 格式（不要 markdown 代码块包裹），结构如下：
{
  "taskName": "任务名称",
  "assignee": "负责人姓名，无则空字符串",
  "startDate": "YYYY-MM-DD 格式开始日期，无则空字符串",
  "endDate": "YYYY-MM-DD 格式截止日期，无则空字符串",
  "priority": "high / medium / low，根据语气判断",
  "status": "待办",
  "notes": "其他补充信息（注意：请不要在此字段中重复复述所属项目名称）"
}`;

        const userPrompt = `请从以下描述中提取任务信息：\n"${input.text}"${input.projectName ? `\n所属项目：${input.projectName}` : ''}`;
        const raw = await this.callAiModel(aiApiUrl, aiApiKey, aiModel, systemPrompt, userPrompt);

        // 解析 AI 返回的 JSON
        try {
          // 兼容模型可能带 markdown 代码块的情况
          const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const parsed = JSON.parse(jsonStr) as {
            taskName: string; assignee: string; startDate: string;
            endDate: string; priority: string; status: string; notes: string;
          };
          // 添加临时 id 用于前端管理
          const taskWithId = {
            ...parsed,
            id: `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`
          };
          return { source: 'ai', success: true, task: taskWithId };
        } catch {
          // JSON 解析失败，返回原始文本供前端降级处理
          return { source: 'ai', success: false, rawText: raw, error: 'AI 返回格式解析失败，请手动填写。' };
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return { source: 'error', success: false, error: `AI 调用失败（${detail}）` };
      }
    }

    // 未配置 AI，返回提示
    return {
      source: 'template',
      success: false,
      error: '未配置 AI 模型，无法使用自然语言录入功能。请在「系统配置」中填写 AI_API_URL、AI_API_KEY 和 AI_MODEL。'
    };
  }

  /**
   * 会议纪要转任务：提取会议发言中的 Action Items，转化为多条任务。
   */
  async parseMeetingText(input: { text: string }) {
    const today = new Date().toISOString().slice(0, 10);
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    if (!aiApiUrl || !aiApiKey || !aiModel) {
      throw new BadRequestException('未配置 AI 模型属性，无法进行会议解析。');
    }

    try {
      const systemPrompt = `你是一名敏捷教练兼 PMO，擅长阅读长篇杂乱的会议纪要（或群聊整理），并从中精准萃取所有的 Action Items (行动项任务)。

当前日期：${today}（周${new Date().getDay() || 7}）

萃取逻辑与约束：
1. 请仅关心【明确要做的事情】，识别出 Who(谁做)、What(做什么)、When(什么时候完成)。若没有指明具体任务，或只是信息同步、背景探讨，请不要将其视为任务。
2. 每个任务的信息都需要映射为以下 JSON 字段：
   - "taskName": 任务的精确名称 / 要做的核心诉求（简明扼要）。
   - "assignee": 负责人姓名（若提及多个人或未提及，则可留空字符串）。
   - "startDate": 起始日期（YYYY-MM-DD）。若仅提到期望几天内完成或只给了 Deadline，按照常理可默认任务从"今天（${today}）"或"明天"开始。无法得知可留空。
   - "endDate": 截止日期（YYYY-MM-DD）。基于"今天"以及上下文（如本周五、下周等）精准推算合法日期；若无说明留空。
   - "priority": high / medium / low。若发言中带强调情绪（必须、赶紧、紧急）则为 high，日常为 medium。
   - "status": 恒定为 "todo"。
   - "notes": 原文发言相关的补充上下文摘要（以备不时之需）。

返回格式：必须返回一个标准 JSON 数组结构（不要 markdown 代码块包裹），例如：
[
  { "taskName": "xxx", "assignee": "xxx", "startDate": "xxx", "endDate": "xxx", "priority": "medium", "status": "todo", "notes": "xxx" },
  { "taskName": "yyy", ... }
]
如果没有提取到任何行动项，返回 []。`;

      const userPrompt = `请从以下会议纪要中提取具体的 Action Items:\n====================\n${input.text}\n====================`;
      const raw = await this.callAiModel(aiApiUrl, aiApiKey, aiModel, systemPrompt, userPrompt, { timeoutMs: 60000 });

      try {
        const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsedTasks = JSON.parse(jsonStr) as Array<{
          taskName: string; assignee: string; startDate: string; endDate: string;
          priority: string; status: string; notes: string;
        }>;
        if (!Array.isArray(parsedTasks)) {
          throw new Error('AI 返回的数据不是数组');
        }
        // 为每个任务添加临时 id 用于前端管理
        const tasksWithIds = parsedTasks.map(task => ({
          ...task,
          id: `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`
        }));
        return { success: true, tasks: tasksWithIds };
      } catch (e) {
        throw new BadRequestException('AI 返回了无法解析的格式文本。返回结果：' + raw);
      }
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      const detail = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`AI 分析失败：${detail}`);
    }
  }

  /** 需求文档/Excel导入：解析文件提取文本并调用 AI 模型提取需求列表 */
  async importRequirementsFromFile(buffer: Buffer, originalname: string) {
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    if (!aiApiUrl || !aiApiKey || !aiModel) {
      throw new BadRequestException('未配置 AI 模型（AI_API_URL / AI_API_KEY / AI_MODEL），无法使用智能解析导入功能。');
    }

    let parsedText = '';
    const lowerName = originalname.toLowerCase();

    try {
      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        parsedText = xlsx.utils.sheet_to_csv(sheet).substring(0, 10000); // 截取前 10000 字符防超长
      } else if (lowerName.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer });
        parsedText = result.value.substring(0, 10000);
      } else if (lowerName.endsWith('.pdf')) {
        const result = await parsePdfBuffer(buffer);
        parsedText = result.text.substring(0, 10000);
      } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
        parsedText = buffer.toString('utf-8').substring(0, 10000);
      } else {
        throw new BadRequestException('不支持的文件格式，仅支持 .xlsx, .xls, .docx, .pdf, .txt, .md');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`文件内容提取失败: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!parsedText.trim()) {
      throw new BadRequestException('未能从文件中提取到有效文本内容。');
    }

    const systemPrompt = `你是一个专业的需求解析助手。你的任务是从用户上传的文件内容（可能是 Excel 导出的 CSV、Word / PDF 纯文本）中提取所有需求条目。

        提取规则：
        1. 识别每一条独立的需求。
        2. 为每条需求提取标题（title）和描述（description）。如果原文结构简单，可把整段原文作为描述，自行概括一个能表达核心意思的简短标题。
        3. 从语义或列数据中推断优先级（priority），必须是 'high', 'medium', 或者 'low'，如果不确定统一默认为 'medium'。
        4. 返回的内容必须是一个合法的 JSON 数组，且一定不要用 markdown block 符号（即不要用 \`\`\`json 包裹）！

期望的 JSON 格式示例：
[
  {
    "title": "用户登录接口",
    "description": "提供账号密码登录，并返回 JWT Token。",
    "priority": "high"
  }
]`;

    const userPrompt = `文件名：${originalname}\n\n文件提取内容：\n${parsedText}`;

    try {
      const raw = await this.callAiModel(aiApiUrl, aiApiKey, aiModel, systemPrompt, userPrompt);
      const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(jsonStr) as Array<{ title: string; description: string; priority: string }>;

      // 进一步清洗数据
      return parsed.map(p => ({
        title: p.title || '（未命名需求）',
        description: p.description || '',
        priority: ['high', 'medium', 'low'].includes(p.priority) ? p.priority : 'medium',
      }));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`AI 解析需求失败: ${detail}`);
    }
  }

  /**
   * 获取 Dashboard 智能摘要
   */
  async getDashboardSummary(input: { projectId?: number }) {
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');
    if (!aiApiUrl || !aiApiKey || !aiModel) {
      return { report: 'AI 配置未就绪，请前往系统配置。' };
    }

    // 聚合核心数据
    const projectFilter = input.projectId ? { id: input.projectId } : {};
    const projects = await this.prisma.project.findMany({
      where: projectFilter,
      include: {
        tasks: true,
        costs: true,
        requirements: true,
      }
    });

    if (projects.length === 0) return { report: '暂无项目数据可供分析。' };

    const totalTasks = projects.reduce((acc, p) => acc + p.tasks.length, 0);
    const doneTasks = projects.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'done').length, 0);
    const blockedTasks = projects.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'blocked').length, 0);
    const totalBudget = projects.reduce((acc, p) => acc + p.budget, 0);
    const totalCost = projects.reduce((acc, p) => acc + p.costs.reduce((sum, c) => sum + c.amount, 0), 0);
    const budgetRate = totalBudget > 0 ? (totalCost / totalBudget * 100).toFixed(1) : '0';

    const systemPrompt = `你是一位高效的项目管理专家。请根据提供的汇总数据，生成一段极其精炼的 Dashboard 智能摘要（执行官简报）。
要求：
1. 字数控制在 150 字以内。
2. 语气专业且具有启发性。
3. 重点突出：进度、风险、资金健康度。
4. 使用 Markdown 加粗关键指标。`;

    const userPrompt = `数据汇报：
- 覆盖项目：${projects.length} 个
- 任务总数：${totalTasks}
- 已完成率：${totalTasks > 0 ? (doneTasks / totalTasks * 100).toFixed(1) : 0}%
- 阻塞中任务：${blockedTasks} 个（警惕）
- 预算消耗：当前已支出 ${totalCost.toLocaleString()} / 总预算 ${totalBudget.toLocaleString()} (消耗率 ${budgetRate}%)
请基于此数据给出简评。`;

    const report = await this.callAiModel(aiApiUrl, aiApiKey, aiModel, systemPrompt, userPrompt);
    return { report };
  }

  /**
   * 获取风险趋势预测
   */
  async predictRisks(input: { projectId?: number }) {
    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');
    if (!aiApiUrl || !aiApiKey || !aiModel) {
      return { report: 'AI 配置未就绪。' };
    }

    const projectFilter = input.projectId ? { projectId: input.projectId } : {};

    // 获取近期的阻塞、逾期信息作为上下文
    const recentTasks = await this.prisma.task.findMany({
      where: {
        ...projectFilter,
        status: { in: ['blocked', 'todo', 'in_progress'] }
      },
      take: 20,
      orderBy: { id: 'desc' }
    });

    const recentChanges = await this.prisma.requirementChange.findMany({
      where: input.projectId ? { requirement: { projectId: input.projectId } } : {},
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    const systemPrompt = `你是一位专门负责量化风险的风控专家。请基于近期的任务阻塞状态和需求变更历史，预测未来的风险走向。
要求：
1. 预测接下来 1-2 周的可能隐患。
2. 给出“风险指数”评估（0-100）。
3. 重点识别：死线逾期、团队空转、范围蔓延。
4. Markdown 格式输出（包含风险指数的醒目标注）。`;

    const userPrompt = `风险上下文数据：
- 当前待办/进行中/阻塞任务：${recentTasks.length} 条。其中阻塞详情：${recentTasks.filter(t => t.status === 'blocked').map(t => t.title).join(', ') || '暂无'}
- 近期需求变更次数（过去 10 条）：${recentChanges.length} 条。
请分析风险分析，并给出一个 0-100 的数值评分。`;

    const report = await this.callAiModel(aiApiUrl, aiApiKey, aiModel, systemPrompt, userPrompt);
    return { report };
  }
}
