import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

type Role = 'super_admin' | 'project_manager' | 'project_director' | 'member' | 'pm' | 'lead' | 'viewer';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  private expandRoles(role: Role): Set<Role> {
    const normalizedRole = role === 'lead' ? 'project_director' : role;
    const roles = new Set<Role>([role, normalizedRole]);
    if (normalizedRole === 'super_admin') {
      // platform admin implies all roles
      roles.add('project_manager');
      roles.add('project_director');
      roles.add('member');
      roles.add('pm');
      roles.add('lead');
      roles.add('viewer');
    }
    if (normalizedRole === 'project_director') {
      roles.add('project_manager');
      roles.add('member');
      roles.add('pm');
      roles.add('lead');
      roles.add('viewer');
    }
    // project_manager: org-level global role, implies member (can read org data)
    if (normalizedRole === 'project_manager') {
      roles.add('member');
      roles.add('pm');
      roles.add('viewer');
    }
    // member: basic org member, implies viewer (can read org data)
    if (normalizedRole === 'member') {
      roles.add('viewer');
    }
    return roles;
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { role?: Role } }>();
    const role = request.user?.role;
    if (!role) {
      throw new ForbiddenException('Role missing');
    }
    const expanded = this.expandRoles(role);
    if (!requiredRoles.some((requiredRole) => expanded.has(requiredRole))) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
