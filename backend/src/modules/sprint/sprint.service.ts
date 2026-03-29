import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';
import { CreateSprintDto, UpdateSprintDto, ListSprintQueryDto } from './dto/sprint.dto';

@Injectable()
export class SprintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async list(actor: AuthActor | undefined, query: ListSprintQueryDto) {
    if (query.projectId) {
      await this.accessService.assertProjectAccess(actor, query.projectId);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.projectId) {
      where.projectId = query.projectId;
    }

    const [items, total] = await Promise.all([
      this.prisma.sprint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { project: { select: { id: true, name: true, alias: true } } }
      }),
      this.prisma.sprint.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async findOne(actor: AuthActor | undefined, id: number) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true, alias: true } } }
    });
    if (!sprint) throw new NotFoundException('Sprint not found');

    await this.accessService.assertProjectAccess(actor, sprint.projectId);
    return sprint;
  }

  async create(actor: AuthActor | undefined, dto: CreateSprintDto) {
    await this.accessService.assertProjectAccess(actor, dto.projectId);

    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.sprint.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        goal: dto.goal,
        status: dto.status ?? 'planning',
        startDate: dto.startDate,
        endDate: dto.endDate
      },
      include: { project: { select: { id: true, name: true, alias: true } } }
    });
  }

  async update(actor: AuthActor | undefined, id: number, dto: UpdateSprintDto) {
    const existing = await this.prisma.sprint.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Sprint not found');

    await this.accessService.assertProjectAccess(actor, existing.projectId);

    return this.prisma.sprint.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.goal !== undefined && { goal: dto.goal }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate })
      },
      include: { project: { select: { id: true, name: true, alias: true } } }
    });
  }

  async remove(actor: AuthActor | undefined, id: number) {
    const existing = await this.prisma.sprint.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Sprint not found');

    await this.accessService.assertProjectAccess(actor, existing.projectId);

    await this.prisma.sprint.delete({ where: { id } });
    return { id };
  }
}
