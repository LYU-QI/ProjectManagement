import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationLevel, RequirementStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

interface CreateRequirementInput {
  projectId: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  version?: string;
}

interface UpdateRequirementInput {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'draft' | 'in_review' | 'approved' | 'planned' | 'done';
  version?: string;
}

@Injectable()
export class RequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(projectId?: number) {
    return this.prisma.requirement.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { id: 'asc' }
    });
  }

  async create(input: CreateRequirementInput) {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true }
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.requirement.create({
      data: {
        ...input,
        status: RequirementStatus.draft
      }
    });
  }

  async review(id: number, reviewer: string, decision: 'approved' | 'rejected', comment?: string) {
    const target = await this.prisma.requirement.findUnique({
      where: { id }
    });
    if (!target) {
      throw new NotFoundException('Requirement not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const requirement = await tx.requirement.update({
        where: { id },
        data: { status: decision === 'approved' ? RequirementStatus.approved : RequirementStatus.draft }
      });
      const review = await tx.requirementReview.create({
        data: {
          requirementId: id,
          reviewer,
          decision,
          comment
        }
      });
      return { requirement, review };
    });

    await this.notificationsService.createSystemNotification({
      projectId: target.projectId,
      level: decision === 'approved' ? NotificationLevel.info : NotificationLevel.warning,
      title: '需求评审结果',
      message: `需求 #${id} 已${decision === 'approved' ? '通过' : '驳回'}评审。`
    });

    return result;
  }

  async change(id: number, description: string, version?: string) {
    const target = await this.prisma.requirement.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Requirement not found');
    }

    const updated = await this.prisma.requirement.update({
      where: { id },
      data: {
        description: description || target.description,
        version: version || target.version,
        changeCount: { increment: 1 }
      }
    });

    await this.notificationsService.createSystemNotification({
      projectId: updated.projectId,
      level: NotificationLevel.info,
      title: '需求发生变更',
      message: `需求「${updated.title}」已更新到版本 ${updated.version ?? 'latest'}。`
    });

    return updated;
  }

  async update(id: number, input: UpdateRequirementInput) {
    const target = await this.prisma.requirement.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Requirement not found');
    }

    return this.prisma.requirement.update({
      where: { id },
      data: input
    });
  }

  async remove(id: number) {
    const target = await this.prisma.requirement.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Requirement not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.requirementReview.deleteMany({ where: { requirementId: id } });
      await tx.requirement.delete({ where: { id } });
    });

    return { id };
  }
}
