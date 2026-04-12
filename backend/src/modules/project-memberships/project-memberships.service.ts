import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectRole } from '@prisma/client';
import { AuditableRequest } from '../../audit/audit.types';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

@Injectable()
export class ProjectMembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) { }

  private setAuditMeta(req: AuditableRequest | undefined, meta: {
    source: string;
    beforeSnapshot?: Prisma.InputJsonValue;
    afterSnapshot?: Prisma.InputJsonValue;
  }) {
    if (!req) return;
    req.auditMeta = {
      ...(req.auditMeta ?? {}),
      ...meta
    };
  }

  async list(actor?: AuthActor) {
    const accessible = await this.accessService.getAccessibleProjectIds(actor);
    return this.prisma.projectMembership.findMany({
      where: accessible === null ? undefined : { projectId: { in: accessible } },
      include: {
        user: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, name: true } }
      },
      orderBy: [{ projectId: 'asc' }, { userId: 'asc' }]
    });
  }

  private async assertCanManageProject(actor: AuthActor | undefined, projectId: number) {
    const normalizedRole = this.accessService.normalizeRole(actor?.role);

    // super_admin 和 project_manager 可以管理所有项目
    if (normalizedRole === 'super_admin' || normalizedRole === 'project_manager') return;

    // pm 只能管理自己创建的项目
    if (normalizedRole === 'pm') {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, ownerId: true }
      });
      if (!project) throw new NotFoundException('Project not found');
      if (project.ownerId !== actor?.sub) {
        throw new ForbiddenException('Only project creator can manage project members');
      }
      return;
    }

    throw new ForbiddenException('No permission to manage project members');
  }

  async create(actor: AuthActor | undefined, input: { userId: number; projectId: number; role: ProjectRole }, req?: AuditableRequest) {
    await this.accessService.assertProjectAccess(actor, input.projectId);
    await this.assertCanManageProject(actor, input.projectId);

    const project = await this.prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');
    const user = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: input.userId,
          projectId: input.projectId
        }
      }
    });
    if (existing) {
      this.setAuditMeta(req, {
        source: 'project_membership.role_change',
        beforeSnapshot: existing as unknown as Prisma.InputJsonValue
      });
    }

    const saved = await this.prisma.projectMembership.upsert({
      where: {
        userId_projectId: {
          userId: input.userId,
          projectId: input.projectId
        }
      },
      update: { role: input.role },
      create: input
    });
    this.setAuditMeta(req, {
      source: existing ? 'project_membership.role_change' : 'project_membership.create',
      beforeSnapshot: existing as unknown as Prisma.InputJsonValue | undefined,
      afterSnapshot: saved as unknown as Prisma.InputJsonValue
    });
    return saved;
  }

  async remove(actor: AuthActor | undefined, id: number, req?: AuditableRequest) {
    const target = await this.prisma.projectMembership.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Project membership not found');
    await this.accessService.assertProjectAccess(actor, target.projectId);
    await this.assertCanManageProject(actor, target.projectId);
    this.setAuditMeta(req, {
      source: 'project_membership.remove',
      beforeSnapshot: target as unknown as Prisma.InputJsonValue
    });

    await this.prisma.projectMembership.delete({ where: { id } });
    const result = { id, userId: target.userId, projectId: target.projectId };
    this.setAuditMeta(req, {
      source: 'project_membership.remove',
      beforeSnapshot: target as unknown as Prisma.InputJsonValue,
      afterSnapshot: result as unknown as Prisma.InputJsonValue
    });
    return { id };
  }
}
