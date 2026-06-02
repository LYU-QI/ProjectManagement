import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';
import { RedisService } from '../cache/cache.service';

export interface CreateDepartmentInput {
  name: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateDepartmentInput {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
}

export interface DepartmentTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  feishuDeptId: string | null;
  children: DepartmentTreeNode[];
}

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
    private readonly redisService: RedisService
  ) {}

  async getDepartmentTree(actor: AuthActor | undefined, organizationId: string, actorOrgRole?: string | null) {
    this.assertCanRead(actor, organizationId, actorOrgRole);
    const departments = await this.prisma.department.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    return this.buildTree(departments);
  }

  async getDepartmentById(actor: AuthActor | undefined, organizationId: string, actorOrgRole: string | null | undefined, id: string) {
    this.assertCanRead(actor, organizationId, actorOrgRole);
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, username: true } }
          }
        },
        children: { orderBy: { sortOrder: 'asc' } }
      }
    });

    if (!dept) {
      throw new NotFoundException('Department not found');
    }
    this.assertSameOrganization(dept.organizationId, organizationId);

    return dept;
  }

  async create(actor: AuthActor | undefined, organizationId: string, actorOrgRole: string | null | undefined, input: CreateDepartmentInput) {
    this.assertCanManage(actor, organizationId, actorOrgRole);
    if (input.parentId) {
      const parent = await this.prisma.department.findUnique({
        where: { id: input.parentId },
        select: { organizationId: true }
      });
      if (!parent) throw new NotFoundException('Parent department not found');
      this.assertSameOrganization(parent.organizationId, organizationId);
    }
    const department = await this.prisma.department.create({
      data: {
        name: input.name,
        organizationId,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0
      }
    });
    await this.invalidateResourceCalendarCache(organizationId);
    return department;
  }

  async update(actor: AuthActor | undefined, organizationId: string, actorOrgRole: string | null | undefined, id: string, input: UpdateDepartmentInput) {
    this.assertCanManage(actor, organizationId, actorOrgRole);
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }
    this.assertSameOrganization(existing.organizationId, organizationId);
    if (input.parentId) {
      if (input.parentId === id) throw new BadRequestException('Department cannot be its own parent');
      const parent = await this.prisma.department.findUnique({
        where: { id: input.parentId },
        select: { organizationId: true }
      });
      if (!parent) throw new NotFoundException('Parent department not found');
      this.assertSameOrganization(parent.organizationId, organizationId);
    }

    const department = await this.prisma.department.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        parentId: input.parentId !== undefined ? input.parentId : existing.parentId,
        sortOrder: input.sortOrder ?? existing.sortOrder
      }
    });
    await this.invalidateResourceCalendarCache(existing.organizationId);
    return department;
  }

  async delete(actor: AuthActor | undefined, organizationId: string, actorOrgRole: string | null | undefined, id: string) {
    this.assertCanManage(actor, organizationId, actorOrgRole);
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }
    this.assertSameOrganization(existing.organizationId, organizationId);
    const children = await this.prisma.department.count({ where: { parentId: id } });
    if (children > 0) {
      throw new BadRequestException('Cannot delete department with child departments');
    }

    await this.prisma.department.updateMany({
      where: { parentId: id },
      data: { parentId: null }
    });

    await this.prisma.orgMember.updateMany({
      where: { departmentId: id },
      data: { departmentId: null }
    });

    const deleted = await this.prisma.department.delete({ where: { id } });
    await this.invalidateResourceCalendarCache(existing.organizationId);
    return deleted;
  }

  private async invalidateResourceCalendarCache(orgId: string) {
    await this.redisService.del(`dashboard:resource-calendar:v2:${orgId}`);
  }

  private assertCanRead(actor: AuthActor | undefined, organizationId: string, actorOrgRole?: string | null) {
    if (!organizationId) throw new ForbiddenException('Organization context is required');
    if (actor?.role === 'super_admin') return;
    if (actorOrgRole) return;
    throw new ForbiddenException('Access denied to this organization');
  }

  private assertCanManage(actor: AuthActor | undefined, organizationId: string, actorOrgRole?: string | null) {
    if (!organizationId) throw new ForbiddenException('Organization context is required');
    if (actor?.role === 'super_admin') return;
    if (actorOrgRole === 'owner' || actorOrgRole === 'admin') return;
    throw new ForbiddenException('Only owner or admin can manage departments');
  }

  private assertSameOrganization(targetOrganizationId: string | null, organizationId: string) {
    if (targetOrganizationId !== organizationId) {
      throw new ForbiddenException('Department does not belong to this organization');
    }
  }

  private buildTree(departments: Array<{
    id: string; name: string; parentId: string | null; sortOrder: number; feishuDeptId: string | null;
  }>): DepartmentTreeNode[] {
    const map = new Map<string, DepartmentTreeNode>();
    const roots: DepartmentTreeNode[] = [];

    for (const dept of departments) {
      map.set(dept.id, { ...dept, children: [] });
    }

    for (const dept of departments) {
      const node = map.get(dept.id)!;
      if (dept.parentId && map.has(dept.parentId)) {
        map.get(dept.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
