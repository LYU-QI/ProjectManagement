import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface CreateProjectInput {
  name: string;
  ownerId: number;
  budget: number;
  startDate?: string;
  endDate?: string;
}

interface UpdateProjectInput {
  name?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.project.findMany({
      orderBy: { id: 'asc' }
    });
  }

  create(input: CreateProjectInput) {
    return this.prisma.project.create({
      data: input
    });
  }

  async update(id: number, input: UpdateProjectInput) {
    const exists = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!exists) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.project.update({
      where: { id },
      data: input
    });
  }

  async remove(id: number) {
    const exists = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!exists) {
      throw new NotFoundException('Project not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { projectId: id } });
      await tx.requirementReview.deleteMany({ where: { requirement: { projectId: id } } });
      await tx.requirement.deleteMany({ where: { projectId: id } });
      await tx.costEntry.deleteMany({ where: { projectId: id } });
      await tx.milestone.deleteMany({ where: { projectId: id } });
      await tx.task.deleteMany({ where: { projectId: id } });
      await tx.worklog.deleteMany({ where: { projectId: id } });
      await tx.project.delete({ where: { id } });
    });

    return { id };
  }
}
