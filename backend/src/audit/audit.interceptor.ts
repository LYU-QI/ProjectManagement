import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { AuditOutcome } from '@prisma/client';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditLogWriterService } from './audit-log-writer.service';
import { AuditableRequest } from './audit.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogWriter: AuditLogWriterService) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuditableRequest>();
    const res = context.switchToHttp().getResponse<{ statusCode?: number }>();

    const method = req.method?.toUpperCase();
    if (!method || method === 'GET' || method === 'OPTIONS') {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          void this.auditLogWriter.write({
            req,
            outcome: 'success',
            statusCode: res.statusCode ?? 200
          });
        }
      }),
      catchError((error: unknown) => {
        const errorStatus = typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : undefined;
        const errorMessage = error instanceof Error ? error.message : String(error);

        void this.auditLogWriter.write({
          req,
          outcome: 'failed',
          statusCode: Number.isFinite(errorStatus) ? errorStatus : 500,
          errorMessage
        });

        return throwError(() => error);
      })
    );
  }
}
