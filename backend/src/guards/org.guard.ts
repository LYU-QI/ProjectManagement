import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { IS_PUBLIC_KEY } from '../modules/auth/public.decorator';
import { IS_ORG_SCOPED_KEY } from '../modules/auth/skip-org-guard.decorator';
import { runWithOrgContext } from '../prisma/org-context';

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const isOrgScoped = this.reflector.getAllAndOverride<boolean>(IS_ORG_SCOPED_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isOrgScoped) return true;

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const user = request['user'] as { sub?: number; role?: string; organizationId?: string; orgRole?: string } | undefined;

    if (user?.role === 'super_admin') {
      request['org'] = { id: null, orgRole: null };
      return true;
    }

    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    const headers = request['headers'] as Record<string, string | undefined>;
    const requestedOrgId = headers?.['x-org-id'];
    const tokenOrgId = user.organizationId;
    const activeOrgId = requestedOrgId ?? tokenOrgId ?? null;

    if (!activeOrgId) {
      throw new ForbiddenException('No organization context');
    }

    const membership = await this.prisma.orgMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.sub,
          organizationId: activeOrgId
        }
      }
    });

    if (!membership) {
      throw new ForbiddenException(`No membership in organization ${activeOrgId}`);
    }

    request['org'] = { id: activeOrgId, orgRole: membership.orgRole };

    runWithOrgContext(
      { organizationId: activeOrgId, bypassOrgFilter: false },
      () => {}
    );

    return true;
  }
}
