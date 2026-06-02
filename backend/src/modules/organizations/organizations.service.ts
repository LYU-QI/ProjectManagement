import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { AuditableRequest } from '../../audit/audit.types';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../cache/cache.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService
  ) {}

  private normalizeImportText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeLookupText(value: unknown): string {
    return this.normalizeImportText(value).toLowerCase();
  }

  private normalizeDepartmentKey(value: unknown): string {
    return this.normalizeLookupText(value).replace(/\\/g, '/').replace(/＞|>/g, '/').replace(/\s*\/\s*/g, ' / ');
  }

  private getImportCell(row: Record<string, unknown>, aliases: string[]): string {
    const normalizedAliases = new Set(aliases.map((alias) => this.normalizeLookupText(alias)));
    for (const [key, value] of Object.entries(row)) {
      if (normalizedAliases.has(this.normalizeLookupText(key))) {
        return this.normalizeImportText(value);
      }
    }
    return '';
  }

  private parseMemberDepartmentRows(file: Express.Multer.File): Array<Record<string, unknown>> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传 Excel 或 CSV 文件');
    }
    const lowerName = (file.originalname || '').toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
      throw new BadRequestException('仅支持 .xlsx、.xls、.csv 文件');
    }
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('导入文件没有可读取的工作表');
    }
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  }

  private buildDepartmentLabelMaps(departments: Array<{ id: string; name: string; parentId: string | null }>) {
    const byParent = new Map<string | null, Array<{ id: string; name: string; parentId: string | null }>>();
    for (const department of departments) {
      const siblings = byParent.get(department.parentId) ?? [];
      siblings.push(department);
      byParent.set(department.parentId, siblings);
    }
    for (const siblings of byParent.values()) {
      siblings.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    }

    const byPath = new Map<string, string>();
    const idsByName = new Map<string, string[]>();
    const visit = (parentId: string | null, prefix: string) => {
      for (const department of byParent.get(parentId) ?? []) {
        const label = prefix ? `${prefix} / ${department.name}` : department.name;
        byPath.set(this.normalizeDepartmentKey(label), department.id);
        const nameKey = this.normalizeDepartmentKey(department.name);
        idsByName.set(nameKey, [...(idsByName.get(nameKey) ?? []), department.id]);
        visit(department.id, label);
      }
    };
    visit(null, '');

    const byName = new Map<string, string>();
    for (const [name, ids] of idsByName.entries()) {
      if (ids.length === 1) byName.set(name, ids[0]);
    }
    return { byPath, byName, idsByName };
  }

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
        _count: { select: { members: true, projects: true } }
      }
    });
    if (!org) throw new NotFoundException('Organization not found');
    return { ...org, memberCount: org._count.members, projectCount: org._count.projects };
  }

  async create(dto: CreateOrganizationDto, actor: { sub?: number; role?: string }, req?: AuditableRequest) {
    if (actor.role !== 'super_admin') {
      throw new ForbiddenException('Only super_admin can create organizations');
    }
    const actorUserId = Number(actor.sub);
    if (!actorUserId) {
      throw new ForbiddenException('Authentication required');
    }
    const actorUser = await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { id: true } });
    if (!actorUser) {
      throw new ForbiddenException('当前登录信息已失效，请重新登录后再创建组织。');
    }

    const existing = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new BadRequestException(`Organization with slug '${dto.slug}' already exists`);
    }

    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          plan: dto.plan ?? 'FREE',
          maxMembers: dto.maxMembers ?? 25
        }
      });

      // 自动将创建者加为 owner 成员
      await tx.orgMember.create({
        data: {
          id: `${created.id}-${actorUserId}`,
          userId: actorUserId,
          organizationId: created.id,
          orgRole: 'owner'
        }
      });

      return created;
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
        throw new BadRequestException(`当前组织下还有 ${org._count.projects} 个项目，请先删除或迁移项目后再删除组织。`);
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
      throw new BadRequestException(`当前组织下还有 ${org._count.projects} 个项目，请先删除或迁移项目后再删除组织。`);
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
        user: { select: { id: true, name: true, username: true, role: true } },
        department: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    return members.map(m => ({
      userId: m.userId,
      name: m.user.name,
      username: m.user.username,
      globalRole: m.user.role,
      orgRole: m.orgRole,
      departmentId: m.departmentId,
      departmentName: m.department?.name ?? null,
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

  async updateMemberDepartment(orgId: string, userId: number, departmentId: string | null, actorOrgRole: string | null, actorGlobalRole?: string, req?: AuditableRequest) {
    if (actorGlobalRole !== 'super_admin' && actorOrgRole !== 'owner' && actorOrgRole !== 'admin') {
      throw new ForbiddenException('Only owner or admin can update member departments');
    }

    const member = await this.prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } }
    });
    if (!member) throw new NotFoundException('Member not found');

    if (departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, organizationId: true }
      });
      if (!department || department.organizationId !== orgId) {
        throw new BadRequestException('Department does not belong to this organization');
      }
    }

    this.setAuditMeta(req, {
      source: 'organization.member_department_change',
      beforeSnapshot: member as unknown as Prisma.InputJsonValue
    });

    const updated = await this.prisma.orgMember.update({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      data: { departmentId }
    });
    await this.invalidateResourceCalendarCache(orgId);
    this.setAuditMeta(req, {
      source: 'organization.member_department_change',
      beforeSnapshot: member as unknown as Prisma.InputJsonValue,
      afterSnapshot: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async importMemberDepartments(orgId: string, file: Express.Multer.File, actorOrgRole: string | null, actorGlobalRole?: string, req?: AuditableRequest) {
    if (actorGlobalRole !== 'super_admin' && actorOrgRole !== 'owner' && actorOrgRole !== 'admin') {
      throw new ForbiddenException('Only owner or admin can update member departments');
    }

    const rows = this.parseMemberDepartmentRows(file);
    if (rows.length === 0) {
      throw new BadRequestException('导入文件没有数据行');
    }
    if (rows.length > 1000) {
      throw new BadRequestException('单次最多导入 1000 行');
    }

    const [members, departments] = await Promise.all([
      this.prisma.orgMember.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { id: true, name: true, username: true } } }
      }),
      this.prisma.department.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, parentId: true }
      })
    ]);

    const membersByUsername = new Map<string, typeof members[number]>();
    const membersByName = new Map<string, Array<typeof members[number]>>();
    for (const member of members) {
      if (member.user.username) {
        membersByUsername.set(this.normalizeLookupText(member.user.username), member);
      }
      const nameKey = this.normalizeLookupText(member.user.name);
      membersByName.set(nameKey, [...(membersByName.get(nameKey) ?? []), member]);
    }
    const departmentMaps = this.buildDepartmentLabelMaps(departments);
    const emptyDepartmentValues = new Set(['', '未分配', '无', '空', 'null', 'none', 'n/a', '-']);

    const results: Array<{
      row: number;
      username?: string;
      name?: string;
      department?: string;
      status: 'success' | 'failed' | 'skipped';
      message: string;
    }> = [];
    const updates: Array<{ userId: number; departmentId: string | null }> = [];
    const seenUserIds = new Set<number>();

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const username = this.getImportCell(row, ['用户名', '账号', 'username', 'userName', 'user']);
      const name = this.getImportCell(row, ['姓名', '成员', '成员姓名', 'name']);
      const departmentText = this.getImportCell(row, ['部门', '部门名称', '部门路径', '所属部门', 'department', 'departmentName']);

      if (!username && !name && !departmentText) {
        results.push({ row: rowNumber, status: 'skipped', message: '空行已跳过' });
        return;
      }

      let member = username ? membersByUsername.get(this.normalizeLookupText(username)) : undefined;
      if (!member && name) {
        const matchedByName = membersByName.get(this.normalizeLookupText(name)) ?? [];
        if (matchedByName.length > 1) {
          results.push({ row: rowNumber, username, name, department: departmentText, status: 'failed', message: '姓名匹配到多个成员，请改用用户名' });
          return;
        }
        member = matchedByName[0];
      }
      if (!member) {
        results.push({ row: rowNumber, username, name, department: departmentText, status: 'failed', message: '未找到当前组织成员' });
        return;
      }
      if (seenUserIds.has(member.userId)) {
        results.push({ row: rowNumber, username, name, department: departmentText, status: 'failed', message: '同一个成员在导入文件中重复出现' });
        return;
      }

      let departmentId: string | null = null;
      const normalizedDepartment = this.normalizeDepartmentKey(departmentText);
      if (!emptyDepartmentValues.has(normalizedDepartment)) {
        const byPath = departmentMaps.byPath.get(normalizedDepartment);
        const byName = departmentMaps.byName.get(normalizedDepartment);
        if (byPath) {
          departmentId = byPath;
        } else if (byName) {
          departmentId = byName;
        } else if ((departmentMaps.idsByName.get(normalizedDepartment) ?? []).length > 1) {
          results.push({ row: rowNumber, username, name, department: departmentText, status: 'failed', message: '部门名称重复，请填写完整部门路径' });
          return;
        } else {
          results.push({ row: rowNumber, username, name, department: departmentText, status: 'failed', message: '未找到当前组织部门' });
          return;
        }
      }

      seenUserIds.add(member.userId);
      updates.push({ userId: member.userId, departmentId });
      results.push({
        row: rowNumber,
        username: member.user.username ?? '',
        name: member.user.name,
        department: departmentText,
        status: 'success',
        message: departmentId ? '已分配部门' : '已设为未分配'
      });
    });

    if (updates.length > 0) {
      await this.prisma.$transaction(updates.map((item) => this.prisma.orgMember.update({
        where: { userId_organizationId: { userId: item.userId, organizationId: orgId } },
        data: { departmentId: item.departmentId }
      })));
      await this.invalidateResourceCalendarCache(orgId);
    }

    const summary = {
      total: rows.length,
      success: results.filter((item) => item.status === 'success').length,
      failed: results.filter((item) => item.status === 'failed').length,
      skipped: results.filter((item) => item.status === 'skipped').length
    };

    this.setAuditMeta(req, {
      source: 'organization.member_department_import',
      afterSnapshot: { summary, results: results.slice(0, 50) } as unknown as Prisma.InputJsonValue
    });

    return { summary, results };
  }

  private async invalidateResourceCalendarCache(orgId: string) {
    await this.redisService.del(`dashboard:resource-calendar:v2:${orgId}`);
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
