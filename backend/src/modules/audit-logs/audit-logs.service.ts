import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId?: number) {
    return this.prisma.auditLog.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { id: 'desc' },
      take: 200
    });
  }
}
