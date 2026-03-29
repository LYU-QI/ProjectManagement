import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AccessService, AuthActor } from '../../../modules/access/access.service';
import {
  CreateTestPlanDto,
  UpdateTestPlanDto,
  ListTestPlanQueryDto,
  AddTestCasesDto,
  ExecuteTestCaseDto
} from './dto/test-plan.dto';

@Injectable()
export class TestPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async list(actor: AuthActor | undefined, query: ListTestPlanQueryDto) {
    const projectId = query.projectId;
    if (projectId) {
      await this.accessService.assertProjectAccess(actor, projectId);
    }

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (query.status) where.status = query.status;
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
      this.prisma.testPlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          project: { select: { id: true, name: true } },
          _count: { select: { items: true } }
        }
      }),
      this.prisma.testPlan.count({ where })
    ]);

    return {
      items: items.map(tp => ({
        ...tp,
        caseCount: tp._count.items,
        _count: undefined
      })),
      total,
      page,
      pageSize
    };
  }

  async findById(actor: AuthActor | undefined, id: number) {
    const item = await this.prisma.testPlan.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        items: {
          include: {
            testCase: {
              select: {
                id: true,
                title: true,
                priority: true,
                status: true,
                description: true
              }
            }
          },
          orderBy: { testCase: { id: 'asc' } }
        }
      }
    });
    if (!item) throw new NotFoundException('Test plan not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);
    return item;
  }

  async create(actor: AuthActor | undefined, dto: CreateTestPlanDto) {
    await this.accessService.assertProjectAccess(actor, dto.projectId);
    const actorId = Number(actor?.sub);
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { organizationId: true }
    });
    return this.prisma.testPlan.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'draft',
        startDate: dto.startDate,
        endDate: dto.endDate,
        creatorId: actorId || null,
        organizationId: project?.organizationId ?? null
      }
    });
  }

  async update(actor: AuthActor | undefined, id: number, dto: UpdateTestPlanDto) {
    const item = await this.prisma.testPlan.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Test plan not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);
    return this.prisma.testPlan.update({
      where: { id },
      data: dto
    });
  }

  async remove(actor: AuthActor | undefined, id: number) {
    const item = await this.prisma.testPlan.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Test plan not found');
    await this.accessService.assertProjectAccess(actor, item.projectId);
    await this.prisma.testPlan.delete({ where: { id } });
    return { success: true };
  }

  async addCases(actor: AuthActor | undefined, id: number, dto: AddTestCasesDto) {
    const plan = await this.prisma.testPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Test plan not found');
    await this.accessService.assertProjectAccess(actor, plan.projectId);

    const actorId = Number(actor?.sub);
    const data = dto.testCaseIds.map(testCaseId => ({
      planId: id,
      testCaseId
    }));

    await this.prisma.testPlanItem.createMany({
      data,
      skipDuplicates: true
    });

    return { success: true, added: dto.testCaseIds.length };
  }

  async executeCase(
    actor: AuthActor | undefined,
    planId: number,
    testCaseId: number,
    dto: ExecuteTestCaseDto
  ) {
    const plan = await this.prisma.testPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Test plan not found');
    await this.accessService.assertProjectAccess(actor, plan.projectId);

    const actorId = Number(actor?.sub);
    const item = await this.prisma.testPlanItem.findUnique({
      where: { planId_testCaseId: { planId, testCaseId } }
    });
    if (!item) throw new NotFoundException('Test case not in plan');

    return this.prisma.testPlanItem.update({
      where: { planId_testCaseId: { planId, testCaseId } },
      data: {
        result: dto.result,
        notes: dto.notes,
        executedAt: dto.result ? new Date() : undefined,
        executorId: actorId || undefined
      }
    });
  }
}
