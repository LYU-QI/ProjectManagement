import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) {
      console.log('[JwtAuthGuard] isPublic=true, skipping');
      return true;
    }

    if (request['method'] === 'OPTIONS') {
      return true;
    }

    const headers = request['headers'] as Record<string, string | undefined>;
    const query = request['query'] as Record<string, string | undefined> | undefined;
    const auth = headers?.['authorization'];
    const queryToken = query?.['access_token'];
    const rawToken = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : queryToken?.trim();
    if (!rawToken) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwtService.verifyAsync(rawToken);
      request['user'] = payload;
      console.log('[JwtAuthGuard] Token verified, user set:', JSON.stringify(payload).slice(0, 100));

      const requestedOrgId = headers?.['x-org-id'] ?? query?.['orgId'];
      request['org'] = {
        id: requestedOrgId ?? payload['organizationId'] ?? null,
        orgRole: payload['orgRole'] ?? null
      };
      return true;
    } catch (err) {
      console.error('[JwtAuthGuard] Token verification failed:', err);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
