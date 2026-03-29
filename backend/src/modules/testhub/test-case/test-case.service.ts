import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AccessService, AuthActor } from '../../../modules/access/access.service';
import { CreateTestCaseDto, UpdateTestCaseDto, ListTestCaseQueryDto } from './dto/test-case.dto';

@Injectable()
export class TestCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async list(actor: AuthActor | undefined, query: ListTestCaseQueryDto) {
    const projectId = query.projectId;
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.tags) where.tags = { contains: query.tags };
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
      this.prisma.testCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          project: { select: { id: true, name: true } }
        }
      }),
      this.prisma.testCase.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async findById(actor: AuthActor | undefined, id: number) {
    const item = await this.prisma.testCase.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, organizationId: true } },
        _count: { select: { testPlanItems: true, bugs: true } }
      }
    });
    if (!item) throw new NotFoundException('Test case not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);
    return item;
  }

  async create(actor: AuthActor | undefined, dto: CreateTestCaseDto) {
    await this.accessService.assertProjectAccess(actor, dto.projectId);
    const actorId = Number(actor?.sub);
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { organizationId: true }
    });
    return this.prisma.testCase.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        preconditions: dto.preconditions,
        steps: dto.steps,
        expectedResult: dto.expectedResult,
        priority: dto.priority ?? 'medium',
        status: dto.status ?? 'draft',
        tags: dto.tags,
        creatorId: actorId || null,
        organizationId: project?.organizationId ?? null
      }
    });
  }

  async update(actor: AuthActor | undefined, id: number, dto: UpdateTestCaseDto) {
    const item = await this.prisma.testCase.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Test case not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);
    return this.prisma.testCase.update({
      where: { id },
      data: dto
    });
  }

  async remove(actor: AuthActor | undefined, id: number) {
    const item = await this.prisma.testCase.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Test case not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);
    await this.prisma.testCase.delete({ where: { id } });
    return { success: true };
  }
}
