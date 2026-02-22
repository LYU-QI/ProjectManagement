import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  list(projectId?: number) {
    return this.prisma.worklog.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { id: 'desc' }
    });
  }

  async create(input: CreateWorklogInput) {
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

  async update(id: number, input: UpdateWorklogInput) {
    const target = await this.prisma.worklog.findUnique({
      where: { id }
    });
    if (!target) {
      throw new NotFoundException('Worklog not found');
    }

    return this.prisma.worklog.update({
      where: { id },
      data: input
    });
  }

  async remove(id: number) {
    const target = await this.prisma.worklog.findUnique({
      where: { id }
    });
    if (!target) {
      throw new NotFoundException('Worklog not found');
    }

    await this.prisma.worklog.delete({ where: { id } });
    return { id };
  }
}
