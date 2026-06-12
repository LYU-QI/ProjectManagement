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
  feishuViewId?: string;
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
  feishuViewId?: string;
}

const PROJECT_WEEKLY_DATA_SOURCE_DEFINITIONS = [
  { sourceType: 'status_risk', label: '项目状态 / 风险表' },
  { sourceType: 'bugs', label: '缺陷表' },
  { sourceType: 'tests', label: '测试概况表' },
  { sourceType: 'resources', label: '资源投入表' },
  { sourceType: 'milestones', label: '交付里程碑表' },
  { sourceType: 'discussion_plans', label: '专项讨论计划清单' }
] as const;

const FEATURE_LIST_DATA_SOURCE_TYPE = 'feature_list';
const FEATURE_LIST_DATA_SOURCE_LABEL = 'Feature List 验收表';

type ProjectWeeklyDataSourceType = typeof PROJECT_WEEKLY_DATA_SOURCE_DEFINITIONS[number]['sourceType'];

interface ProjectWeeklyDataSourceInput {
  sourceType: string;
  appToken?: string | null;
  tableId?: string | null;
  viewId?: string | null;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async list(actor?: AuthActor, organizationId?: string | null) {
    if (!organizationId) return [];
    const ids = await this.accessService.getAccessibleProjectIds(actor);
    return this.prisma.project.findMany({
      where: {
        organizationId,
        ...(ids === null ? {} : { id: { in: ids } })
      },
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

  create(input: CreateProjectInput, actor?: AuthActor, organizationId?: string | null) {
    const ownerId = Number(actor?.sub);
    if (!ownerId) {
      throw new ForbiddenException('Only authenticated users can create project');
    }
    if (!organizationId) {
      throw new ForbiddenException('No organization context');
    }
    const alias = this.normalizeAlias(input.alias);
    if (!alias) {
      throw new BadRequestException('项目别名不能为空，且必须为大写英文字母。');
    }
    return this.prisma.project.create({
      data: {
        ...input,
        alias,
        ownerId,
        organizationId
      }
    });
  }

  async update(id: number, input: UpdateProjectInput, actor?: AuthActor, organizationId?: string | null) {
    if (!organizationId) {
      throw new ForbiddenException('No organization context');
    }
    await this.accessService.assertProjectAccess(actor, id);
    const exists = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, organizationId: true }
    });
    if (!exists || exists.organizationId !== organizationId) {
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

  private async assertProjectInOrganization(id: number, actor?: AuthActor, organizationId?: string | null) {
    if (!organizationId) {
      throw new ForbiddenException('No organization context');
    }
    await this.accessService.assertProjectAccess(actor, id);
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, organizationId: true }
    });
    if (!project || project.organizationId !== organizationId) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private normalizeWeeklyDataSources(rows: Array<{ sourceType: string; appToken?: string | null; tableId?: string | null; viewId?: string | null }>) {
    const byType = new Map(rows.map((row) => [row.sourceType, row]));
    return PROJECT_WEEKLY_DATA_SOURCE_DEFINITIONS.map((definition) => {
      const row = byType.get(definition.sourceType);
      return {
        sourceType: definition.sourceType,
        label: definition.label,
        appToken: row?.appToken ?? '',
        tableId: row?.tableId ?? '',
        viewId: row?.viewId ?? ''
      };
    });
  }

  async weeklyDataSources(id: number, actor?: AuthActor, organizationId?: string | null) {
    await this.assertProjectInOrganization(id, actor, organizationId);
    const rows = await this.prisma.projectWeeklyDataSource.findMany({
      where: { projectId: id },
      orderBy: { id: 'asc' }
    });
    return {
      projectId: id,
      sources: this.normalizeWeeklyDataSources(rows)
    };
  }

  async updateWeeklyDataSources(id: number, input: ProjectWeeklyDataSourceInput[], actor?: AuthActor, organizationId?: string | null) {
    await this.assertProjectInOrganization(id, actor, organizationId);
    const allowedTypes = new Set<ProjectWeeklyDataSourceType>(PROJECT_WEEKLY_DATA_SOURCE_DEFINITIONS.map((item) => item.sourceType));
    const rows = Array.isArray(input) ? input : [];

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const sourceType = String(row.sourceType || '').trim() as ProjectWeeklyDataSourceType;
        if (!allowedTypes.has(sourceType)) {
          throw new BadRequestException(`未知的周报数据源类型：${sourceType || '-'}`);
        }
        const appToken = String(row.appToken || '').trim();
        const tableId = String(row.tableId || '').trim();
        const viewId = String(row.viewId || '').trim();
        if (!appToken && !tableId && !viewId) {
          await tx.projectWeeklyDataSource.deleteMany({ where: { projectId: id, sourceType } });
          continue;
        }
        await tx.projectWeeklyDataSource.upsert({
          where: { projectId_sourceType: { projectId: id, sourceType } },
          update: { appToken: appToken || null, tableId: tableId || null, viewId: viewId || null },
          create: { projectId: id, sourceType, appToken: appToken || null, tableId: tableId || null, viewId: viewId || null }
        });
      }
    });

    return this.weeklyDataSources(id, actor, organizationId);
  }

  async featureListDataSource(id: number, actor?: AuthActor, organizationId?: string | null) {
    await this.assertProjectInOrganization(id, actor, organizationId);
    const row = await this.prisma.projectWeeklyDataSource.findUnique({
      where: { projectId_sourceType: { projectId: id, sourceType: FEATURE_LIST_DATA_SOURCE_TYPE } }
    });
    return {
      projectId: id,
      source: {
        sourceType: FEATURE_LIST_DATA_SOURCE_TYPE,
        label: FEATURE_LIST_DATA_SOURCE_LABEL,
        appToken: row?.appToken ?? '',
        tableId: row?.tableId ?? '',
        viewId: row?.viewId ?? ''
      }
    };
  }

  async updateFeatureListDataSource(id: number, input: ProjectWeeklyDataSourceInput, actor?: AuthActor, organizationId?: string | null) {
    await this.assertProjectInOrganization(id, actor, organizationId);
    const appToken = String(input?.appToken || '').trim();
    const tableId = String(input?.tableId || '').trim();
    const viewId = String(input?.viewId || '').trim();

    if (!appToken && !tableId && !viewId) {
      await this.prisma.projectWeeklyDataSource.deleteMany({
        where: { projectId: id, sourceType: FEATURE_LIST_DATA_SOURCE_TYPE }
      });
      return this.featureListDataSource(id, actor, organizationId);
    }

    await this.prisma.projectWeeklyDataSource.upsert({
      where: { projectId_sourceType: { projectId: id, sourceType: FEATURE_LIST_DATA_SOURCE_TYPE } },
      update: { appToken: appToken || null, tableId: tableId || null, viewId: viewId || null },
      create: {
        projectId: id,
        sourceType: FEATURE_LIST_DATA_SOURCE_TYPE,
        appToken: appToken || null,
        tableId: tableId || null,
        viewId: viewId || null
      }
    });
    return this.featureListDataSource(id, actor, organizationId);
  }

  async remove(id: number, actor?: AuthActor, organizationId?: string | null) {
    if (!organizationId) {
      throw new ForbiddenException('No organization context');
    }
    await this.accessService.assertProjectAccess(actor, id);
    const exists = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, organizationId: true }
    });
    if (!exists || exists.organizationId !== organizationId) {
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
      await tx.projectWeeklyDataSource.deleteMany({ where: { projectId: id } });
      await tx.project.delete({ where: { id } });
    });

    return { id };
  }
}
