import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface WeeklyReportInput {
  projectIds: number[];
  weekStart: string;
  weekEnd: string;
  includeRisks: boolean;
  includeBudget: boolean;
}

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

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

    const draft = [
      `项目周报（${input.weekStart} 至 ${input.weekEnd}）`,
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

    return {
      generatedAt: new Date().toISOString(),
      evidence: details,
      report: draft
    };
  }
}
