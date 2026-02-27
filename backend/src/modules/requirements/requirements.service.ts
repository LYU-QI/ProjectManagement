import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationLevel, RequirementStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessService, AuthActor } from '../access/access.service';

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
    private readonly notificationsService: NotificationsService,
    private readonly accessService: AccessService
  ) { }

  async list(actor: AuthActor | undefined, projectId?: number) {
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }
    const accessible = await this.accessService.getAccessibleProjectIds(actor);
    return this.prisma.requirement.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(accessible === null ? {} : { projectId: { in: accessible } })
      },
      orderBy: { id: 'asc' }
    });
  }

  async create(actor: AuthActor | undefined, input: CreateRequirementInput) {
    await this.accessService.assertProjectAccess(actor, input.projectId);
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

  async review(actor: AuthActor | undefined, id: number, reviewer: string, decision: 'approved' | 'rejected', comment?: string) {
    const target = await this.prisma.requirement.findUnique({
      where: { id }
    });
    if (!target) {
      throw new NotFoundException('Requirement not found');
    }
    await this.accessService.assertProjectAccess(actor, target.projectId);

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

  async change(actor: AuthActor | undefined, id: number, description: string, version?: string, reason?: string, changedBy?: string) {
    const target = await this.prisma.requirement.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Requirement not found');
    }
    await this.accessService.assertProjectAccess(actor, target.projectId);

    const before = {
      title: target.title,
      description: target.description,
      priority: target.priority,
      status: target.status,
      version: target.version
    };
    const nextDescription = description || target.description;
    const nextVersion = version || target.version;
    const after = {
      ...before,
      description: nextDescription,
      version: nextVersion
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.requirement.update({
        where: { id },
        data: {
          description: nextDescription,
          version: nextVersion,
          changeCount: { increment: 1 }
        }
      });
      await tx.requirementChange.create({
        data: {
          requirementId: id,
          changedBy,
          reason,
          before: before as any,
          after: after as any,
          version: nextVersion
        }
      });
      return updated;
    });

    await this.notificationsService.createSystemNotification({
      projectId: result.projectId,
      level: NotificationLevel.info,
      title: '需求发生变更',
      message: `需求「${result.title}」已更新到版本 ${result.version ?? 'latest'}。`
    });

    return result;
  }

  async update(actor: AuthActor | undefined, id: number, input: UpdateRequirementInput) {
    const target = await this.prisma.requirement.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Requirement not found');
    }
    await this.accessService.assertProjectAccess(actor, target.projectId);

    return this.prisma.requirement.update({
      where: { id },
      data: input
    });
  }

  async remove(actor: AuthActor | undefined, id: number) {
    const target = await this.prisma.requirement.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Requirement not found');
    }
    await this.accessService.assertProjectAccess(actor, target.projectId);

    await this.prisma.$transaction(async (tx) => {
      await tx.requirementReview.deleteMany({ where: { requirementId: id } });
      await tx.requirementChange.deleteMany({ where: { requirementId: id } });
      await tx.requirement.delete({ where: { id } });
    });

    return { id };
  }

  async listChanges(actor: AuthActor | undefined, requirementId: number) {
    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      select: { projectId: true }
    });
    if (!requirement) {
      throw new NotFoundException('Requirement not found');
    }
    await this.accessService.assertProjectAccess(actor, requirement.projectId);
    return this.prisma.requirementChange.findMany({
      where: { requirementId },
      orderBy: { id: 'desc' }
    });
  }
}
