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
          return `- ${item.projectName}: blocked=${item.blockedTasks}, budgetVariance=${item.budgetVarianceRate}%, requirementChanges=${item.requirementChanges}`;
        }
        return `- ${item.projectName}: overall stable.`;
      })
      .join('\n');

    const draft = [
      `Weekly Report (${input.weekStart} to ${input.weekEnd})`,
      '',
      '1) Overall Status',
      `${details.length} projects tracked.`,
      '',
      '2) Key Risks',
      input.includeRisks ? riskLines : '- Risk section disabled.',
      '',
      '3) Budget Snapshot',
      input.includeBudget
        ? details.map((item) => `- ${item.projectName}: budget variance ${item.budgetVarianceRate}%`).join('\n')
        : '- Budget section disabled.',
      '',
      '4) Next Week Focus',
      '- Clear blocked tasks on critical path.',
      '- Lock high-change requirements through review gate.',
      '- Track budget drift every 2 days for high-risk projects.'
    ].join('\n');

    return {
      generatedAt: new Date().toISOString(),
      evidence: details,
      report: draft
    };
  }
}
