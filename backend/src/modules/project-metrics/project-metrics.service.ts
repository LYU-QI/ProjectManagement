import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ProjectMetricsPeriod {
  start: string;
  end: string;
}

export interface ProjectMetricsSummary {
  projectId: number;
  budget: number;
  directCost: number;
  laborCost: number;
  actualCost: number;
  totalHours: number;
  varianceRate: number;
  budgetRemaining: number;
  byType: {
    labor: number;
    outsource: number;
    cloud: number;
  };
  period?: {
    start: string;
    end: string;
    directCost: number;
    laborCost: number;
    actualCost: number;
  };
}

@Injectable()
export class ProjectMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async summarizeProject(projectId: number, period?: ProjectMetricsPeriod): Promise<ProjectMetricsSummary | null> {
    const summaries = await this.summarizeProjects([projectId], period);
    return summaries[0] ?? null;
  }

  async summarizeProjects(projectIds: number[], period?: ProjectMetricsPeriod): Promise<ProjectMetricsSummary[]> {
    const ids = Array.from(new Set(projectIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (ids.length === 0) return [];

    const [projects, costEntries, worklogs] = await Promise.all([
      this.prisma.project.findMany({
        where: { id: { in: ids } },
        select: { id: true, budget: true }
      }),
      this.prisma.costEntry.findMany({
        where: { projectId: { in: ids } },
        select: { projectId: true, type: true, amount: true, occurredOn: true }
      }),
      this.prisma.worklog.findMany({
        where: { projectId: { in: ids } },
        select: {
          projectId: true,
          hours: true,
          hourlyRate: true,
          workedOn: true,
          weekStart: true,
          weekEnd: true
        }
      })
    ]);

    const summaries = new Map<number, ProjectMetricsSummary>();

    for (const project of projects) {
      summaries.set(project.id, {
        projectId: project.id,
        budget: project.budget,
        directCost: 0,
        laborCost: 0,
        actualCost: 0,
        totalHours: 0,
        varianceRate: 0,
        budgetRemaining: project.budget,
        byType: {
          labor: 0,
          outsource: 0,
          cloud: 0
        },
        ...(period
          ? {
              period: {
                start: period.start,
                end: period.end,
                directCost: 0,
                laborCost: 0,
                actualCost: 0
              }
            }
          : {})
      });
    }

    const inPeriod = (value?: string | null) => {
      if (!period || !value) return false;
      return value >= period.start && value <= period.end;
    };

    for (const entry of costEntries) {
      const summary = summaries.get(entry.projectId);
      if (!summary) continue;
      summary.directCost += entry.amount;
      summary.byType[entry.type] += entry.amount;
      if (summary.period && inPeriod(entry.occurredOn)) {
        summary.period.directCost += entry.amount;
      }
    }

    for (const worklog of worklogs) {
      const summary = summaries.get(worklog.projectId);
      if (!summary) continue;
      const laborCost = worklog.hours * worklog.hourlyRate;
      summary.laborCost += laborCost;
      summary.byType.labor += laborCost;
      summary.totalHours += worklog.hours;
      if (summary.period && (inPeriod(worklog.workedOn) || inPeriod(worklog.weekEnd) || inPeriod(worklog.weekStart))) {
        summary.period.laborCost += laborCost;
      }
    }

    for (const summary of summaries.values()) {
      summary.actualCost = summary.directCost + summary.laborCost;
      summary.budgetRemaining = summary.budget - summary.actualCost;
      summary.varianceRate = summary.budget === 0
        ? 0
        : Number((((summary.actualCost - summary.budget) / summary.budget) * 100).toFixed(2));
      if (summary.period) {
        summary.period.actualCost = summary.period.directCost + summary.period.laborCost;
      }
    }

    return ids
      .map((id) => summaries.get(id))
      .filter((item): item is ProjectMetricsSummary => Boolean(item));
  }
}
