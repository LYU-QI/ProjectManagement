import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

interface CreateProjectInput {
  name: string;
  alias: string;
  budget: number;
  startDate?: string;
  endDate?: string;
  feishuChatIds?: string;
  feishuAppToken?: string;
  feishuTableId?: string;
}

interface UpdateProjectInput {
  name?: string;
  alias?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  feishuChatIds?: string;
  feishuAppToken?: string;
  feishuTableId?: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async list(actor?: AuthActor) {
    const ids = await this.accessService.getAccessibleProjectIds(actor);
    return this.prisma.project.findMany({
      where: ids === null ? undefined : { id: { in: ids } },
      orderBy: { id: 'asc' }
    });
  }

  private normalizeAlias(aliasRaw: string | undefined): string | undefined {
    if (typeof aliasRaw !== 'string') return undefined;
    const alias = aliasRaw.trim().toUpperCase();
    if (!alias) return undefined;
    if (!/^[A-Z]+$/.test(alias)) {
      throw new BadRequestException('项目别名仅支持大写英文字母（A-Z）。');
    }
    return alias;
  }

  create(input: CreateProjectInput, actor?: AuthActor) {
    const ownerId = Number(actor?.sub);
    if (!ownerId) {
      throw new ForbiddenException('Only authenticated users can create project');
    }
    const alias = this.normalizeAlias(input.alias);
    if (!alias) {
      throw new BadRequestException('项目别名不能为空，且必须为大写英文字母。');
    }
    return this.prisma.project.create({
      data: {
        ...input,
        alias,
        ownerId
      }
    });
  }

  async update(id: number, input: UpdateProjectInput, actor?: AuthActor) {
    await this.accessService.assertProjectAccess(actor, id);
    const exists = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!exists) {
      throw new NotFoundException('Project not found');
    }

    const normalizedAlias = this.normalizeAlias(input.alias);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...input,
        ...(typeof input.alias === 'undefined' ? {} : { alias: normalizedAlias ?? null })
      }
    });
  }

  async remove(id: number, actor?: AuthActor) {
    await this.accessService.assertProjectAccess(actor, id);
    const exists = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!exists) {
      throw new NotFoundException('Project not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.prdVersion.deleteMany({ where: { document: { projectId: id } } });
      await tx.prdDocument.deleteMany({ where: { projectId: id } });
      await tx.notification.deleteMany({ where: { projectId: id } });
      await tx.requirementReview.deleteMany({ where: { requirement: { projectId: id } } });
      await tx.requirementChange.deleteMany({ where: { requirement: { projectId: id } } });
      await tx.requirement.deleteMany({ where: { projectId: id } });
      await tx.costEntry.deleteMany({ where: { projectId: id } });
      await tx.milestone.deleteMany({ where: { projectId: id } });
      await tx.task.deleteMany({ where: { projectId: id } });
      await tx.worklog.deleteMany({ where: { projectId: id } });
      await tx.auditLog.deleteMany({ where: { projectId: id } });
      await tx.project.delete({ where: { id } });
    });

    return { id };
  }
}
