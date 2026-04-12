import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuditableRequest } from '../../audit/audit.types';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

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

  list() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        username: true
      },
      orderBy: { id: 'asc' }
    });
  }

  private assertCanManageUsers(actor: AuthActor | undefined) {
    const actorId = Number(actor?.sub);
    if (!actorId) throw new ForbiddenException('Only authenticated users can manage users');
    const actorRole = this.accessService.normalizeRole(actor?.role);
    if (!['super_admin', 'project_manager'].includes(actorRole)) {
      throw new ForbiddenException('No permission to manage users');
    }
  }

  private assertCanAssignRole(actorRole: string, role: UserRole) {
    if (actorRole === 'super_admin') return;
    if (role === 'super_admin') {
      throw new ForbiddenException('Only super_admin can assign super_admin role');
    }
  }

  private assertCanModifyTarget(actorRole: string, targetRole: UserRole) {
    if (actorRole === 'super_admin') return;
    if (targetRole === 'super_admin') {
      throw new ForbiddenException('Only super_admin can modify super_admin users');
    }
  }

  async createUser(
    actor: AuthActor | undefined,
    input: { username: string; name: string; password: string; role: UserRole },
    req?: AuditableRequest
  ) {
    const actorRole = this.accessService.normalizeRole(actor?.role);
    this.assertCanManageUsers(actor);
    this.assertCanAssignRole(actorRole, input.role);

    const username = input.username.trim().toLowerCase();
    const name = input.name.trim();
    if (!username || !name || !input.password) {
      throw new BadRequestException('username/name/password is required');
    }

    const existing = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (existing) throw new ConflictException('Username already exists');

    const created = await this.prisma.user.create({
      data: {
        username,
        name,
        password: input.password,
        role: input.role
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true
      }
    });
    this.setAuditMeta(req, {
      source: 'user_management.create',
      afterSnapshot: created as unknown as Prisma.InputJsonValue
    });
    return created;
  }

  async updateRole(actor: AuthActor | undefined, id: number, role: UserRole, req?: AuditableRequest) {
    const actorRole = this.accessService.normalizeRole(actor?.role);
    this.assertCanManageUsers(actor);
    this.assertCanAssignRole(actorRole, role);

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true, name: true }
    });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanModifyTarget(actorRole, target.role);
    this.setAuditMeta(req, {
      source: 'user_management.role_change',
      beforeSnapshot: target as unknown as Prisma.InputJsonValue
    });

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        username: true,
        role: true
      }
    });
    this.setAuditMeta(req, {
      source: 'user_management.role_change',
      beforeSnapshot: target as unknown as Prisma.InputJsonValue,
      afterSnapshot: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async resetPassword(actor: AuthActor | undefined, id: number, password: string, req?: AuditableRequest) {
    const actorRole = this.accessService.normalizeRole(actor?.role);
    this.assertCanManageUsers(actor);
    const nextPassword = password.trim();
    if (!nextPassword) throw new BadRequestException('password is required');

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true, name: true }
    });
    if (!target) throw new NotFoundException('User not found');
    this.assertCanModifyTarget(actorRole, target.role);
    this.setAuditMeta(req, {
      source: 'user_management.password_reset',
      beforeSnapshot: {
        id: target.id,
        username: target.username,
        role: target.role
      } as unknown as Prisma.InputJsonValue
    });

    await this.prisma.user.update({
      where: { id },
      data: { password: nextPassword }
    });
    const result = { id, username: target.username, ok: true };
    this.setAuditMeta(req, {
      source: 'user_management.password_reset',
      beforeSnapshot: {
        id: target.id,
        username: target.username,
        role: target.role
      } as unknown as Prisma.InputJsonValue,
      afterSnapshot: {
        id,
        username: target.username,
        passwordReset: true
      } as unknown as Prisma.InputJsonValue
    });
    return result;
  }

  async removeUser(actor: AuthActor | undefined, id: number, req?: AuditableRequest) {
    const actorId = Number(actor?.sub);
    const actorRole = this.accessService.normalizeRole(actor?.role);
    if (!actorId || actorRole !== 'super_admin') {
      throw new ForbiddenException('Only super_admin can delete users');
    }
    if (actorId === id) {
      throw new BadRequestException('Cannot delete the current logged-in user');
    }

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true, name: true }
    });
    if (!target) throw new NotFoundException('User not found');
    this.setAuditMeta(req, {
      source: 'user_management.delete',
      beforeSnapshot: target as unknown as Prisma.InputJsonValue
    });

    if (target.role === 'super_admin') {
      const superAdminCount = await this.prisma.user.count({
        where: { role: 'super_admin' }
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the last super_admin user');
      }
    }

    const [ownedProjects, createdWorkItems] = await Promise.all([
      this.prisma.project.count({ where: { ownerId: id } }),
      this.prisma.workItem.count({ where: { creatorId: id } })
    ]);

    if (ownedProjects > 0) {
      throw new BadRequestException('Cannot delete user who still owns projects');
    }
    if (createdWorkItems > 0) {
      throw new BadRequestException('Cannot delete user who is referenced as work item creator');
    }

    await this.prisma.$transaction([
      this.prisma.orgMember.deleteMany({ where: { userId: id } }),
      this.prisma.projectMembership.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } })
    ]);

    const result = { id, username: target.username, ok: true };
    this.setAuditMeta(req, {
      source: 'user_management.delete',
      beforeSnapshot: target as unknown as Prisma.InputJsonValue,
      afterSnapshot: result as unknown as Prisma.InputJsonValue
    });
    return result;
  }
}
