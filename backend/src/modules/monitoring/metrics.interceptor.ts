import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const method = request.method ?? 'UNKNOWN';
    const endpoint = this.normalizeEndpoint(request.route?.path ?? request.url ?? '/');
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const status = response.statusCode ?? 200;
          this.metricsService.record({
            method,
            endpoint,
            status,
            responseTimeMs: Date.now() - start,
            timestamp: Date.now(),
          });
        },
        error: (err) => {
          const status = err?.status ?? 500;
          this.metricsService.record({
            method,
            endpoint,
            status,
            responseTimeMs: Date.now() - start,
            timestamp: Date.now(),
          });
        },
      }),
    );
  }

  private normalizeEndpoint(path: string): string {
    // Normalize paths with numeric IDs to :id placeholders
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/gi, '/:id');
  }
}
