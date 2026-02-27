import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  async updateRole(actor: AuthActor | undefined, id: number, role: UserRole) {
    const actorId = Number(actor?.sub);
    if (!actorId) throw new ForbiddenException('Only authenticated users can update roles');

    const actorRole = this.accessService.normalizeRole(actor?.role);
    if (!['super_admin', 'project_director'].includes(actorRole)) {
      throw new ForbiddenException('No permission to update user role');
    }

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true, name: true }
    });
    if (!target) throw new NotFoundException('User not found');

    if (actorRole === 'project_director') {
      const blockedCurrent = ['super_admin', 'project_director', 'lead'];
      if (blockedCurrent.includes(target.role)) {
        throw new ForbiddenException('Project director cannot modify this user');
      }
      const allowedNext: UserRole[] = ['project_manager', 'pm', 'viewer'];
      if (!allowedNext.includes(role)) {
        throw new ForbiddenException('Project director can only assign project_manager/pm/viewer');
      }
    }

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
}
