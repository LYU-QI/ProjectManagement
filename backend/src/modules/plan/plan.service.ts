import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Plan } from '@prisma/client';

@Injectable()
export class PlanLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async checkProjectLimit(organizationId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true, _count: { select: { projects: true } } }
    });
    if (!org) return true;

    const limits: Record<Plan, number> = {
      FREE: 3,
      PRO: 20,
      ENTERPRISE: Infinity
    };
    const limit = limits[org.plan] ?? 3;
    return org._count.projects < limit;
  }

  async checkMemberLimit(organizationId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { maxMembers: true, _count: { select: { members: true } } }
    });
    if (!org) return true;
    return org._count.members < org.maxMembers;
  }

  async enforceProjectLimit(organizationId: string): Promise<void> {
    const allowed = await this.checkProjectLimit(organizationId);
    if (!allowed) {
      throw new ForbiddenException('Project limit reached for your plan. Please upgrade to create more projects.');
    }
  }

  async enforceMemberLimit(organizationId: string): Promise<void> {
    const allowed = await this.checkMemberLimit(organizationId);
    if (!allowed) {
      throw new ForbiddenException('Member limit reached for this organization.');
    }
  }
}
