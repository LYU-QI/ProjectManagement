import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditableRequest } from '../../audit/audit.types';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async listForUser(userId: number) {
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId },
      include: { organization: true }
    });
    return memberships.map(m => ({
      id: m.organization.id,
      slug: m.organization.slug,
      name: m.organization.name,
      plan: m.organization.plan,
      orgRole: m.orgRole,
      joinedAt: m.createdAt
    }));
  }

  async findById(id: string, actorOrgId: string | null) {
    if (actorOrgId !== null && actorOrgId !== id) {
      throw new ForbiddenException('Access denied to this organization');
    }
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { members: true } }
      }
    });
    if (!org) throw new NotFoundException('Organization not found');
    return { ...org, memberCount: org._count.members };
  }

  async create(dto: CreateOrganizationDto, actor: { sub?: number; role?: string }, req?: AuditableRequest) {
    if (actor.role !== 'super_admin') {
      throw new ForbiddenException('Only super_admin can create organizations');
    }

    const existing = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new BadRequestException(`Organization with slug '${dto.slug}' already exists`);
    }

    const org = await this.prisma.organization.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        plan: dto.plan ?? 'FREE',
        maxMembers: dto.maxMembers ?? 25
      }
    });

    // 自动将创建者加为 owner 成员
    await this.prisma.orgMember.create({
      data: {
        id: `${org.id}-${actor.sub}`,
        userId: actor.sub!,
        organizationId: org.id,
        orgRole: 'owner'
      }
    });

    this.setAuditMeta(req, {
      source: 'organization.create',
      afterSnapshot: org as unknown as Prisma.InputJsonValue
    });
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto, actorOrgRole: string | null, actorGlobalRole?: string, req?: AuditableRequest) {
    const existing = await this.prisma.organization.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Organization not found');
    this.setAuditMeta(req, {
      source: 'organization.update',
      beforeSnapshot: existing as unknown as Prisma.InputJsonValue
    });
    if (actorGlobalRole === 'super_admin') {
      const updated = await this.prisma.organization.update({ where: { id }, data: dto });
      this.setAuditMeta(req, {
        source: 'organization.update',
        beforeSnapshot: existing as unknown as Prisma.InputJsonValue,
        afterSnapshot: updated as unknown as Prisma.InputJsonValue
      });
      return updated;
    }
    if (actorOrgRole !== 'owner' && actorOrgRole !== 'admin') {
      throw new ForbiddenException('Only owner or admin can update organization');
    }
    const updated = await this.prisma.organization.update({
      where: { id },
      data: dto
    });
    this.setAuditMeta(req, {
      source: 'organization.update',
      beforeSnapshot: existing as unknown as Prisma.InputJsonValue,
      afterSnapshot: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async delete(id: string, actorOrgRole: string | null, actorGlobalRole?: string, req?: AuditableRequest) {
    if (actorGlobalRole === 'super_admin') {
      const org = await this.prisma.organization.findUnique({
        where: { id },
        include: { _count: { select: { projects: true } } }
      });
      if (!org) throw new NotFoundException('Organization not found');
      this.setAuditMeta(req, {
        source: 'organization.delete',
        beforeSnapshot: org as unknown as Prisma.InputJsonValue
      });
      if (org._count.projects > 0) {
        throw new BadRequestException('Cannot delete organization with existing projects');
      }
      await this.prisma.$transaction([
        this.prisma.orgMember.deleteMany({ where: { organizationId: id } }),
        this.prisma.department.deleteMany({ where: { organizationId: id } }),
        this.prisma.config.deleteMany({ where: { organizationId: id } }),
        this.prisma.wikiPage.deleteMany({ where: { organizationId: id } }),
        this.prisma.automationRule.deleteMany({ where: { organizationId: id } }),
        this.prisma.orgApiKey.deleteMany({ where: { organizationId: id } }),
        this.prisma.orgWebhook.deleteMany({ where: { organizationId: id } }),
        this.prisma.organization.delete({ where: { id } })
      ]);
      const result = { success: true };
      this.setAuditMeta(req, {
        source: 'organization.delete',
        beforeSnapshot: org as unknown as Prisma.InputJsonValue,
        afterSnapshot: result as unknown as Prisma.InputJsonValue
      });
      return result;
    }
    if (actorOrgRole !== 'owner') {
      throw new ForbiddenException('Only owner can delete organization');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { projects: true } } }
    });
    if (!org) throw new NotFoundException('Organization not found');
    this.setAuditMeta(req, {
      source: 'organization.delete',
      beforeSnapshot: org as unknown as Prisma.InputJsonValue
    });
    if (org._count.projects > 0) {
      throw new BadRequestException('Cannot delete organization with existing projects');
    }

    await this.prisma.$transaction([
      this.prisma.orgMember.deleteMany({ where: { organizationId: id } }),
      this.prisma.department.deleteMany({ where: { organizationId: id } }),
      this.prisma.config.deleteMany({ where: { organizationId: id } }),
      this.prisma.wikiPage.deleteMany({ where: { organizationId: id } }),
      this.prisma.automationRule.deleteMany({ where: { organizationId: id } }),
      this.prisma.orgApiKey.deleteMany({ where: { organizationId: id } }),
      this.prisma.orgWebhook.deleteMany({ where: { organizationId: id } }),
      this.prisma.organization.delete({ where: { id } })
    ]);
    const result = { success: true };
    this.setAuditMeta(req, {
      source: 'organization.delete',
      beforeSnapshot: org as unknown as Prisma.InputJsonValue,
      afterSnapshot: result as unknown as Prisma.InputJsonValue
    });
    return result;
  }

  async listMembers(orgId: string, actorOrgId: string | null, actorGlobalRole?: string) {
    if (actorGlobalRole !== 'super_admin' && actorOrgId !== null && actorOrgId !== orgId) {
      throw new ForbiddenException('Access denied');
    }
    const members = await this.prisma.orgMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    return members.map(m => ({
      userId: m.userId,
      name: m.user.name,
      username: m.user.username,
      globalRole: m.user.role,
      orgRole: m.orgRole,
      joinedAt: m.createdAt
    }));
  }

  async inviteMember(orgId: string, userId: number, role: string, actorOrgRole: string | null, actorGlobalRole?: string, req?: AuditableRequest) {
    if (actorGlobalRole !== 'super_admin' && actorOrgRole !== 'owner' && actorOrgRole !== 'admin') {
      throw new ForbiddenException('Only owner or admin can invite members');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } }
    });
    if (existing) throw new BadRequestException('User is already a member');

    const member = await this.prisma.orgMember.create({
      data: {
        id: `${orgId}-${userId}`,
        userId,
        organizationId: orgId,
        orgRole: role as 'owner' | 'admin' | 'member' | 'viewer'
      },
      include: { user: { select: { id: true, name: true, username: true } } }
    });

    const result = {
      userId: member.userId,
      name: member.user.name,
      username: member.user.username,
      orgRole: member.orgRole
    };
    this.setAuditMeta(req, {
      source: 'organization.member_invite',
      afterSnapshot: result as unknown as Prisma.InputJsonValue
    });
    return result;
  }

  async updateMemberRole(orgId: string, userId: number, role: string, actorOrgRole: string | null, actorGlobalRole?: string, req?: AuditableRequest) {
    if (actorGlobalRole !== 'super_admin' && actorOrgRole !== 'owner' && actorOrgRole !== 'admin') {
      throw new ForbiddenException('Only owner or admin can update member roles');
    }

    const member = await this.prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } }
    });
    if (!member) throw new NotFoundException('Member not found');
    this.setAuditMeta(req, {
      source: 'organization.member_role_change',
      beforeSnapshot: member as unknown as Prisma.InputJsonValue
    });

    const updated = await this.prisma.orgMember.update({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      data: { orgRole: role as 'owner' | 'admin' | 'member' | 'viewer' }
    });
    this.setAuditMeta(req, {
      source: 'organization.member_role_change',
      beforeSnapshot: member as unknown as Prisma.InputJsonValue,
      afterSnapshot: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async removeMember(orgId: string, userId: number, actorOrgRole: string | null, actorGlobalRole?: string, req?: AuditableRequest) {
    if (actorGlobalRole !== 'super_admin' && actorOrgRole !== 'owner' && actorOrgRole !== 'admin') {
      throw new ForbiddenException('Only owner or admin can remove members');
    }

    const member = await this.prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } }
    });
    if (!member) throw new NotFoundException('Member not found');
    this.setAuditMeta(req, {
      source: 'organization.member_remove',
      beforeSnapshot: member as unknown as Prisma.InputJsonValue
    });

    if (member.orgRole === 'owner') {
      throw new ForbiddenException('Cannot remove the owner');
    }

    await this.prisma.orgMember.delete({
      where: { userId_organizationId: { userId, organizationId: orgId } }
    });
    const result = { success: true, userId, organizationId: orgId };
    this.setAuditMeta(req, {
      source: 'organization.member_remove',
      beforeSnapshot: member as unknown as Prisma.InputJsonValue,
      afterSnapshot: result as unknown as Prisma.InputJsonValue
    });
    return { success: true };
  }
}
