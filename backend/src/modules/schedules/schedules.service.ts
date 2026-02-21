import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationLevel, TaskStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

interface CreateTaskInput {
  projectId: number;
  title: string;
  assignee: string;
  status: TaskStatus;
  plannedStart: string;
  plannedEnd: string;
}

interface UpdateTaskInput {
  title?: string;
  assignee?: string;
  status?: TaskStatus;
  plannedStart?: string;
  plannedEnd?: string;
}

interface UpdateMilestoneInput {
  name?: string;
  plannedDate?: string;
  actualDate?: string;
}

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async getProjectSchedule(projectId: number) {
    const [tasks, milestones] = await Promise.all([
      this.prisma.task.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
      this.prisma.milestone.findMany({ where: { projectId }, orderBy: { id: 'asc' } })
    ]);
    return { tasks, milestones };
  }

  async createTask(input: CreateTaskInput) {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true }
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const created = await this.prisma.task.create({
      data: input
    });
    if (input.status === TaskStatus.blocked) {
      await this.notificationsService.createSystemNotification({
        projectId: input.projectId,
        level: NotificationLevel.warning,
        title: '任务阻塞预警',
        message: `任务「${input.title}」已标记为 blocked。`
      });
    }
    return created;
  }

  async createMilestone(input: { projectId: number; name: string; plannedDate: string }) {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true }
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.milestone.create({
      data: input
    });
  }

  async updateMilestone(id: number, input: UpdateMilestoneInput) {
    const target = await this.prisma.milestone.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Milestone not found');
    }
    return this.prisma.milestone.update({
      where: { id },
      data: input
    });
  }

  async removeMilestone(id: number) {
    const target = await this.prisma.milestone.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Milestone not found');
    }
    await this.prisma.milestone.delete({ where: { id } });
    return { id };
  }

  async risk(projectId: number) {
    const tasks = await this.prisma.task.findMany({ where: { projectId } });
    const blockedCount = tasks.filter((item) => item.status === TaskStatus.blocked).length;
    const inProgressCount = tasks.filter((item) => item.status === TaskStatus.in_progress).length;
    const riskLevel = blockedCount >= 2 ? 'high' : blockedCount === 1 ? 'medium' : 'low';
    return { projectId, blockedCount, inProgressCount, riskLevel };
  }

  async updateTask(id: number, input: UpdateTaskInput) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return this.prisma.task.update({
      where: { id },
      data: input
    });
  }

  async removeTask(id: number) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.prisma.task.delete({ where: { id } });
    return { id };
  }
}
