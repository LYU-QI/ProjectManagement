import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

type Role = 'super_admin' | 'project_director' | 'project_manager' | 'pm' | 'lead' | 'viewer';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  private expandRoles(role: Role): Set<Role> {
    const roles = new Set<Role>([role]);
    if (role === 'super_admin') {
      roles.add('project_director');
      roles.add('project_manager');
      roles.add('lead');
      roles.add('pm');
      roles.add('viewer');
    }
    if (role === 'project_director') {
      roles.add('lead');
      roles.add('project_manager');
      roles.add('pm');
      roles.add('viewer');
    }
    if (role === 'lead') {
      roles.add('project_manager');
      roles.add('pm');
      roles.add('viewer');
    }
    if (role === 'project_manager') {
      roles.add('pm');
      roles.add('viewer');
    }
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
