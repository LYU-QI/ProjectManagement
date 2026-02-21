import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../database/prisma.service';

type AuthUser = {
  sub?: number;
  name?: string;
  role?: string;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      body?: Record<string, unknown>;
      user?: AuthUser;
      params?: Record<string, string>;
    }>();

    const method = req.method?.toUpperCase();
    if (!method || method === 'GET' || method === 'OPTIONS') {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const path = req.originalUrl ?? '';
          const isLogin = path.includes('/api/v1/auth/login');
          const rawBody = isLogin ? { username: req.body?.username } : req.body;
          const requestBody = rawBody
            ? (JSON.parse(JSON.stringify(rawBody)) as Prisma.InputJsonValue)
            : undefined;
          const projectIdFromBody = Number(req.body?.projectId);
          const projectIdFromParam = Number(req.params?.id);
          const projectId = Number.isFinite(projectIdFromBody)
            ? projectIdFromBody
            : Number.isFinite(projectIdFromParam)
              ? projectIdFromParam
              : null;

          void this.prisma.auditLog
            .create({
              data: {
                userId: req.user?.sub,
                userName: req.user?.name,
                userRole: req.user?.role,
                method,
                path,
                projectId: projectId ?? undefined,
                requestBody
              }
            })
            .catch(() => undefined);
        }
      })
    );
  }
}
