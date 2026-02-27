import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

@Injectable()
export class ProjectMembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) { }

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

  async create(actor: AuthActor | undefined, input: { userId: number; projectId: number; role: ProjectRole }) {
    await this.accessService.assertProjectAccess(actor, input.projectId);
    const project = await this.prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');
    const user = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.projectMembership.upsert({
      where: {
        userId_projectId: {
          userId: input.userId,
          projectId: input.projectId
        }
      },
      update: { role: input.role },
      create: input
    });
  }

  async remove(actor: AuthActor | undefined, id: number) {
    const target = await this.prisma.projectMembership.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Project membership not found');
    await this.accessService.assertProjectAccess(actor, target.projectId);
    await this.prisma.projectMembership.delete({ where: { id } });
    return { id };
  }
}

