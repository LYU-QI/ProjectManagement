import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

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

  private resolveActorRole(actor: AuthActor | undefined): 'super_admin' | 'project_director' {
    const actorId = Number(actor?.sub);
    if (!actorId) throw new ForbiddenException('Only authenticated users can manage users');
    const actorRole = this.accessService.normalizeRole(actor?.role);
    if (!['super_admin', 'project_director'].includes(actorRole)) {
      throw new ForbiddenException('No permission to manage users');
    }
    return actorRole as 'super_admin' | 'project_director';
  }

  private assertAssignableRole(actorRole: 'super_admin' | 'project_director', role: UserRole) {
    if (actorRole === 'super_admin') return;
    const allowedNext: UserRole[] = ['project_manager', 'pm', 'viewer'];
    if (!allowedNext.includes(role)) {
      throw new ForbiddenException('Project director can only assign project_manager/pm/viewer');
    }
  }

  private assertMutableTarget(actorRole: 'super_admin' | 'project_director', targetRole: UserRole) {
    if (actorRole === 'super_admin') return;
    const blockedCurrent: UserRole[] = ['super_admin', 'project_director', 'lead'];
    if (blockedCurrent.includes(targetRole)) {
      throw new ForbiddenException('Project director cannot modify this user');
    }
  }

  async createUser(
    actor: AuthActor | undefined,
    input: { username: string; name: string; password: string; role: UserRole }
  ) {
    const actorRole = this.resolveActorRole(actor);
    this.assertAssignableRole(actorRole, input.role);

    const username = input.username.trim().toLowerCase();
    const name = input.name.trim();
    if (!username || !name || !input.password) {
      throw new BadRequestException('username/name/password is required');
    }

    const existing = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (existing) throw new ConflictException('Username already exists');

    return this.prisma.user.create({
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
  }

  async updateRole(actor: AuthActor | undefined, id: number, role: UserRole) {
    const actorRole = this.resolveActorRole(actor);
    this.assertAssignableRole(actorRole, role);

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true, name: true }
    });
    if (!target) throw new NotFoundException('User not found');
    this.assertMutableTarget(actorRole, target.role);

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        username: true,
        role: true
      }
    });
  }

  async resetPassword(actor: AuthActor | undefined, id: number, password: string) {
    const actorRole = this.resolveActorRole(actor);
    const nextPassword = password.trim();
    if (!nextPassword) throw new BadRequestException('password is required');

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true, name: true }
    });
    if (!target) throw new NotFoundException('User not found');
    this.assertMutableTarget(actorRole, target.role);

    await this.prisma.user.update({
      where: { id },
      data: { password: nextPassword }
    });
    return { id, username: target.username, ok: true };
  }
}
