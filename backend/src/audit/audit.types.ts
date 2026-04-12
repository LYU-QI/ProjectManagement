import { Prisma } from '@prisma/client';

export type AuditRequestMeta = {
  source?: string;
  beforeSnapshot?: Prisma.InputJsonValue;
  afterSnapshot?: Prisma.InputJsonValue;
};

export type AuditableRequest = {
  method: string;
  originalUrl?: string;
  body?: Record<string, unknown>;
  user?: {
    sub?: number;
    name?: string;
    role?: string;
    organizationId?: string | null;
  };
  params?: Record<string, string>;
  org?: { id?: string | null };
  headers?: Record<string, string | string[] | undefined>;
  auditMeta?: AuditRequestMeta;
};
