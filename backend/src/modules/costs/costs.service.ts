import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationLevel } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

interface CreateCostInput {
  projectId: number;
  type: 'labor' | 'outsource' | 'cloud';
  amount: number;
  occurredOn: string;
  note?: string;
}

interface UpdateCostInput {
  type?: 'labor' | 'outsource' | 'cloud';
  amount?: number;
  occurredOn?: string;
  note?: string;
}

@Injectable()
export class CostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  list(projectId?: number) {
    return this.prisma.costEntry.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { id: 'asc' }
    });
  }

  async create(input: CreateCostInput) {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true }
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const created = await this.prisma.costEntry.create({
      data: input
    });

    const summary = await this.summary(input.projectId);
    if (summary.varianceRate > 10) {
      await this.notificationsService.createSystemNotification({
        projectId: input.projectId,
        level: NotificationLevel.warning,
        title: '预算超支预警',
        message: `项目 #${input.projectId} 当前预算偏差 ${summary.varianceRate}%`
      });
    }

    return created;
  }

  async summary(projectId: number) {
    const [project, rows, worklogs] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.costEntry.findMany({ where: { projectId } }),
      this.prisma.worklog.findMany({ where: { projectId } })
    ]);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const worklogLaborCost = worklogs.reduce((sum, item) => sum + item.hours * item.hourlyRate, 0);
    const entryCost = rows.reduce((sum, item) => sum + item.amount, 0);
    const actual = entryCost + worklogLaborCost;
    const byType = rows.reduce(
      (acc, item) => {
        acc[item.type] += item.amount;
        return acc;
      },
      { labor: 0, outsource: 0, cloud: 0 }
    );
    byType.labor += worklogLaborCost;
    const budget = project.budget;
    const varianceRate = budget === 0 ? 0 : Number((((actual - budget) / budget) * 100).toFixed(2));
    return { projectId, budget, actual, varianceRate, byType };
  }

  async update(id: number, input: UpdateCostInput) {
    const target = await this.prisma.costEntry.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Cost entry not found');
    }

    return this.prisma.costEntry.update({
      where: { id },
      data: input
    });
  }

  async remove(id: number) {
    const target = await this.prisma.costEntry.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Cost entry not found');
    }

    await this.prisma.costEntry.delete({ where: { id } });
    return { id };
  }
}
