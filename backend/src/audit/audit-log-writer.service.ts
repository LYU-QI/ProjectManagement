import { Injectable } from '@nestjs/common';
import { AuditOutcome, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditableRequest, AuditRequestMeta } from './audit.types';

@Injectable()
export class AuditLogWriterService {
  constructor(private readonly prisma: PrismaService) {}

  private cloneAndRedact(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.cloneAndRedact(item));
    }
    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, current]) => {
        const lowered = key.toLowerCase();
        if (
          lowered.includes('password')
          || lowered.includes('secret')
          || lowered === 'token'
          || lowered.endsWith('token')
          || lowered.includes('apikey')
          || lowered.includes('api_key')
        ) {
          acc[key] = '***';
          return acc;
        }
        acc[key] = this.cloneAndRedact(current);
        return acc;
      }, {});
    }
    return value;
  }

  sanitizeRequestBody(path: string, body?: Record<string, unknown>) {
    if (!body) return undefined;
    if (path.includes('/api/v1/auth/login')) {
      return { username: String(body.username ?? '') } as Prisma.InputJsonValue;
    }
    if (path.includes('/api/v1/auth/register')) {
      return {
        username: String(body.username ?? ''),
        name: String(body.name ?? ''),
        role: String(body.role ?? '')
      } as Prisma.InputJsonValue;
    }
    return this.cloneAndRedact(body) as Prisma.InputJsonValue;
  }

  sanitizeSnapshot(snapshot?: Prisma.InputJsonValue) {
    if (snapshot === undefined || snapshot === null) return undefined;
    return this.cloneAndRedact(snapshot) as Prisma.InputJsonValue;
  }

  resolveProjectId(body?: Record<string, unknown>, params?: Record<string, string>) {
    const candidates = [
      body?.projectId,
      body?.targetProjectId,
      body?.sourceProjectId,
      params?.projectId,
      params?.id
    ];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }
    return undefined;
  }

  resolveResource(path: string, body?: Record<string, unknown>, params?: Record<string, string>) {
    const segments = path.split('?')[0].split('/').filter(Boolean);
    const apiIndex = segments.findIndex((segment) => segment === 'v1');
    const resourceSegment = apiIndex >= 0 ? segments[apiIndex + 1] : segments[segments.length - 1];
    const rawResourceId = params?.id
      ?? params?.projectId
      ?? (typeof body?.id === 'string' || typeof body?.id === 'number' ? body.id : undefined)
      ?? (typeof body?.recordId === 'string' ? body.recordId : undefined)
      ?? (typeof body?.taskId === 'string' ? body.taskId : undefined);

    return {
      resourceType: resourceSegment || 'unknown',
      resourceId: rawResourceId !== undefined && rawResourceId !== null ? String(rawResourceId) : undefined
    };
  }

  resolveSource(req: AuditableRequest, meta?: AuditRequestMeta) {
    if (meta?.source) return meta.source;
    const headerValue = req.headers?.['x-client-source'];
    if (typeof headerValue === 'string' && headerValue.trim()) return headerValue.trim();
    return 'http';
  }

  async write(input: {
    req: AuditableRequest;
    outcome: AuditOutcome;
    statusCode?: number;
    errorMessage?: string;
  }) {
    const path = input.req.originalUrl ?? '';
    const meta = input.req.auditMeta;
    const { resourceType, resourceId } = this.resolveResource(path, input.req.body, input.req.params);

    await this.prisma.auditLog.create({
      data: {
        userId: input.req.user?.sub,
        userName: input.req.user?.name,
        userRole: input.req.user?.role,
        method: input.req.method?.toUpperCase() || 'UNKNOWN',
        path,
        source: this.resolveSource(input.req, meta),
        projectId: this.resolveProjectId(input.req.body, input.req.params),
        organizationId: input.req.org?.id ?? input.req.user?.organizationId ?? undefined,
        requestBody: this.sanitizeRequestBody(path, input.req.body),
        beforeSnapshot: this.sanitizeSnapshot(meta?.beforeSnapshot),
        afterSnapshot: this.sanitizeSnapshot(meta?.afterSnapshot),
        outcome: input.outcome,
        statusCode: input.statusCode,
        errorMessage: input.errorMessage,
        resourceType,
        resourceId
      }
    }).catch(() => undefined);
  }
}
