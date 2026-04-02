import { Injectable } from '@nestjs/common';
import { BugStatus, RequirementStatus, TaskStatus, WorkItemStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';
import { RedisService } from '../cache/cache.service';

@Injectable()
export class DashboardService {
  private readonly cacheTtl = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
    private readonly redisService: RedisService
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
}
