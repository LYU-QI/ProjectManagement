import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [projects, requirements, costs, tasks, worklogs] = await Promise.all([
      this.prisma.project.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.requirement.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.costEntry.findMany(),
      this.prisma.task.findMany(),
      this.prisma.worklog.findMany()
    ]);

    const projectCards = projects.map((project) => {
      const projectRequirements = requirements.filter((item) => item.projectId === project.id);
      const projectCosts = costs.filter((item) => item.projectId === project.id);
      const projectWorklogs = worklogs.filter((item) => item.projectId === project.id);
      const blockedTasks = tasks.filter((item) => item.projectId === project.id && item.status === TaskStatus.blocked).length;
      const worklogLaborCost = projectWorklogs.reduce((sum, item) => sum + item.hours * item.hourlyRate, 0);
      const actualCost = projectCosts.reduce((sum, item) => sum + item.amount, 0) + worklogLaborCost;
      const varianceRate = project.budget === 0 ? 0 : Number((((actualCost - project.budget) / project.budget) * 100).toFixed(2));
      const requirementRisk = projectRequirements.filter((item) => item.changeCount >= 2).length;
      const healthScore = Math.max(0, 100 - Math.abs(varianceRate) - blockedTasks * 12 - requirementRisk * 8);

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
}
