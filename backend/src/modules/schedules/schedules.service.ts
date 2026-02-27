import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationLevel, TaskStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessService, AuthActor } from '../access/access.service';

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

interface CreateDependencyInput {
  projectName: string;
  taskRecordId: string;
  taskId?: string;
  dependsOnRecordId: string;
  dependsOnTaskId?: string;
  type: 'FS' | 'SS' | 'FF';
}

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly accessService: AccessService
  ) {}

  async getProjectSchedule(actor: AuthActor | undefined, projectId: number) {
    await this.accessService.assertProjectAccess(actor, projectId);
    const [tasks, milestones] = await Promise.all([
      this.prisma.task.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
      this.prisma.milestone.findMany({ where: { projectId }, orderBy: { id: 'asc' } })
    ]);
    return { tasks, milestones };
  }

  async createTask(actor: AuthActor | undefined, input: CreateTaskInput) {
    await this.accessService.assertProjectAccess(actor, input.projectId);
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

  async createMilestone(actor: AuthActor | undefined, input: { projectId: number; name: string; plannedDate: string }) {
    await this.accessService.assertProjectAccess(actor, input.projectId);
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

  async updateMilestone(actor: AuthActor | undefined, id: number, input: UpdateMilestoneInput) {
    const target = await this.prisma.milestone.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Milestone not found');
    }
    await this.accessService.assertProjectAccess(actor, target.projectId);
    return this.prisma.milestone.update({
      where: { id },
      data: input
    });
  }

  async removeMilestone(actor: AuthActor | undefined, id: number) {
    const target = await this.prisma.milestone.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Milestone not found');
    }
    await this.accessService.assertProjectAccess(actor, target.projectId);
    await this.prisma.milestone.delete({ where: { id } });
    return { id };
  }

  async risk(actor: AuthActor | undefined, projectId: number) {
    await this.accessService.assertProjectAccess(actor, projectId);
    const tasks = await this.prisma.task.findMany({ where: { projectId } });
    const blockedCount = tasks.filter((item) => item.status === TaskStatus.blocked).length;
    const inProgressCount = tasks.filter((item) => item.status === TaskStatus.in_progress).length;
    const riskLevel = blockedCount >= 2 ? 'high' : blockedCount === 1 ? 'medium' : 'low';
    return { projectId, blockedCount, inProgressCount, riskLevel };
  }

  async listDependencies(actor: AuthActor | undefined, projectName?: string) {
    const accessible = await this.accessService.getAccessibleProjectIds(actor);
    const projects = await this.prisma.project.findMany({
      where: accessible === null ? undefined : { id: { in: accessible } },
      select: { name: true }
    });
    const allowedProjectNames = new Set(projects.map((p) => p.name));
    return this.prisma.feishuDependency.findMany({
      where: {
        ...(projectName ? { projectName } : {}),
        ...(accessible === null ? {} : { projectName: { in: Array.from(allowedProjectNames.values()) } })
      },
      orderBy: { id: 'asc' }
    });
  }

  async createDependency(actor: AuthActor | undefined, input: CreateDependencyInput) {
    const accessible = await this.accessService.getAccessibleProjectIds(actor);
    if (accessible !== null) {
      const project = await this.prisma.project.findFirst({
        where: { name: input.projectName, id: { in: accessible } },
        select: { id: true }
      });
      if (!project) {
        throw new NotFoundException(`No access to project ${input.projectName}`);
      }
    }
    return this.prisma.feishuDependency.create({
      data: {
        projectName: input.projectName,
        taskRecordId: input.taskRecordId,
        taskId: input.taskId ?? null,
        dependsOnRecordId: input.dependsOnRecordId,
        dependsOnTaskId: input.dependsOnTaskId ?? null,
        type: input.type
      }
    });
  }

  async removeDependency(actor: AuthActor | undefined, id: number) {
    const target = await this.prisma.feishuDependency.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Dependency not found');
    const accessible = await this.accessService.getAccessibleProjectIds(actor);
    if (accessible !== null) {
      const project = await this.prisma.project.findFirst({
        where: { name: target.projectName, id: { in: accessible } },
        select: { id: true }
      });
      if (!project) {
        throw new NotFoundException(`No access to project ${target.projectName}`);
      }
    }
    await this.prisma.feishuDependency.delete({ where: { id } });
    return { id };
  }

  async updateTask(actor: AuthActor | undefined, id: number, input: UpdateTaskInput) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.accessService.assertProjectAccess(actor, task.projectId);
    return this.prisma.task.update({
      where: { id },
      data: input
    });
  }

  async removeTask(actor: AuthActor | undefined, id: number) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.accessService.assertProjectAccess(actor, task.projectId);
    await this.prisma.task.delete({ where: { id } });
    return { id };
  }
}
