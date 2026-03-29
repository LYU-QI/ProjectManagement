import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../modules/api-keys/api-keys.service';
import { IS_PUBLIC_KEY } from '../modules/auth/public.decorator';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeysService: ApiKeysService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const apiKey = (request.headers as Record<string, string>)?.['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    const result = await this.apiKeysService.validateKey(apiKey);
    request['org'] = { id: result.organizationId, orgRole: null };
    request['apiKeyPermissions'] = result.permissions;

    return true;
  }
}
