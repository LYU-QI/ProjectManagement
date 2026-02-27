import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

interface CreateWorklogInput {
  projectId: number;
  userId?: number;
  assigneeName?: string;
  taskTitle?: string;
  weekStart?: string;
  weekEnd?: string;
  totalDays?: number;
  hours: number;
  hourlyRate: number;
  workedOn: string;
}

interface UpdateWorklogInput {
  taskTitle?: string;
  assigneeName?: string;
  weekStart?: string;
  weekEnd?: string;
  totalDays?: number;
  hours?: number;
  hourlyRate?: number;
  workedOn?: string;
}

@Injectable()
export class WorklogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async list(actor: AuthActor | undefined, projectId?: number) {
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }
    const accessible = await this.accessService.getAccessibleProjectIds(actor);
    return this.prisma.worklog.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(accessible === null ? {} : { projectId: { in: accessible } })
      },
      orderBy: { id: 'desc' }
    });
  }

  async create(actor: AuthActor | undefined, input: CreateWorklogInput) {
    await this.accessService.assertProjectAccess(actor, input.projectId);
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true }
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (input.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true }
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
    }

    return this.prisma.worklog.create({
      data: input
    });
  }

  async update(actor: AuthActor | undefined, id: number, input: UpdateWorklogInput) {
    const target = await this.prisma.worklog.findUnique({
      where: { id }
    });
    if (!target) {
      throw new NotFoundException('Worklog not found');
    }
    await this.accessService.assertProjectAccess(actor, target.projectId);

    return this.prisma.worklog.update({
      where: { id },
      data: input
    });
  }

  async remove(actor: AuthActor | undefined, id: number) {
    const target = await this.prisma.worklog.findUnique({
      where: { id }
    });
    if (!target) {
      throw new NotFoundException('Worklog not found');
    }
    await this.accessService.assertProjectAccess(actor, target.projectId);

    await this.prisma.worklog.delete({ where: { id } });
    return { id };
  }
}
