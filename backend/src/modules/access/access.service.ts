import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type AuthActor = {
  sub?: number;
  role?: string;
  organizationId?: string | null;
  orgRole?: string | null;
};

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) { }

  normalizeRole(role?: string): string {
    if (!role) return '';
    return role;
  }

  isGlobalRole(role?: string): boolean {
    const normalized = this.normalizeRole(role);
    return normalized === 'super_admin' || normalized === 'project_manager';
  }

  async getAccessibleProjectIds(actor?: AuthActor): Promise<number[] | null> {
    if (!actor?.sub) return [];
    if (this.isGlobalRole(actor.role)) return null;

    const [owned, memberships] = await Promise.all([
      this.prisma.project.findMany({
        where: { ownerId: actor.sub },
        select: { id: true }
      }),
      this.prisma.projectMembership.findMany({
        where: { userId: actor.sub },
        select: { projectId: true }
      })
    ]);
    const set = new Set<number>([
      ...owned.map((item) => item.id),
      ...memberships.map((item) => item.projectId)
    ]);
    return Array.from(set.values());
  }

  async assertProjectAccess(actor: AuthActor | undefined, projectId: number) {
    const ids = await this.getAccessibleProjectIds(actor);
    if (ids === null) return;
    if (!ids.includes(projectId)) {
      throw new ForbiddenException(`No access to project ${projectId}`);
    }
  }
}

