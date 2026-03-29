import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

type Role = 'super_admin' | 'project_manager' | 'member' | 'pm' | 'viewer';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  private expandRoles(role: Role): Set<Role> {
    const roles = new Set<Role>([role]);
    if (role === 'super_admin') {
      // platform admin implies all roles
      roles.add('project_manager');
      roles.add('member');
      roles.add('pm');
      roles.add('viewer');
    }
    // project_manager: org-level global role, implies member (can read org data)
    if (role === 'project_manager') {
      roles.add('member');
    }
    // member: basic org member, implies viewer (can read org data)
    if (role === 'member') {
      roles.add('viewer');
    }
    // pm: project manager role, implies viewer (can read project data)
    if (role === 'pm') {
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
