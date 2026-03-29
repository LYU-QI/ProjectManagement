import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AccessService, AuthActor } from '../../../modules/access/access.service';
import { CreateBugDto, UpdateBugDto, ListBugQueryDto } from './dto/bug.dto';

@Injectable()
export class BugService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async list(actor: AuthActor | undefined, query: ListBugQueryDto) {
    const projectId = query.projectId;
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.priority) where.priority = query.priority;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } }
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.bug.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          project: { select: { id: true, name: true } },
          testCase: { select: { id: true, title: true } }
        }
      }),
      this.prisma.bug.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async findById(actor: AuthActor | undefined, id: number) {
    const item = await this.prisma.bug.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        testCase: { select: { id: true, title: true } }
      }
    });
    if (!item) throw new NotFoundException('Bug not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);
    return item;
  }

  async create(actor: AuthActor | undefined, dto: CreateBugDto) {
    await this.accessService.assertProjectAccess(actor, dto.projectId);
    const actorId = Number(actor?.sub);
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { organizationId: true }
    });
    const actorUser = actorId
      ? await this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } })
      : null;

    return this.prisma.bug.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        steps: dto.steps,
        severity: dto.severity ?? 'major',
        priority: dto.priority ?? 'medium',
        status: 'open',
        testCaseId: dto.testCaseId,
        assigneeId: dto.assigneeId,
        assigneeName: dto.assigneeName,
        reporterId: actorId || null,
        reporterName: actorUser?.name ?? null,
        organizationId: project?.organizationId ?? null
      }
    });
  }

  async update(actor: AuthActor | undefined, id: number, dto: UpdateBugDto) {
    const item = await this.prisma.bug.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Bug not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);

    const data: Record<string, unknown> = { ...dto };

    // Auto-set resolvedAt / closedAt based on status transitions
    if (dto.status === 'resolved' && item.status !== 'resolved') {
      data.resolvedAt = new Date();
    }
    if (dto.status === 'closed' && item.status !== 'closed') {
      data.closedAt = new Date();
    }

    return this.prisma.bug.update({
      where: { id },
      data
    });
  }

  async remove(actor: AuthActor | undefined, id: number) {
    const item = await this.prisma.bug.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Bug not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);
    await this.prisma.bug.delete({ where: { id } });
    return { success: true };
  }
}
