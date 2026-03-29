import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../modules/auth/public.decorator';

@Injectable()
export class IpGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      org?: { allowedIps?: string | null };
      ip?: string;
      connection?: { remoteAddress?: string };
      headers?: Record<string, string | undefined>;
    }>();

    const org = request.org;
    const allowedIps = org?.allowedIps;

    // No restriction if allowedIps is not set
    if (!allowedIps || allowedIps.trim() === '') {
      return true;
    }

    // Extract client IP from various sources
    const clientIp =
      request.ip ||
      request.connection?.remoteAddress ||
      request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers?.['x-real-ip'] ||
      'unknown';

    const allowedList = allowedIps
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean);

    if (allowedList.includes(clientIp)) {
      return true;
    }

    throw new ForbiddenException(`Access denied from IP: ${clientIp}. Please contact your administrator.`);
  }
}
