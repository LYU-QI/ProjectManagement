import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WorkItemPriority, WorkItemStatus, WorkItemType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

interface ListWorkItemsInput {
  projectId?: number;
  scope?: string;
  status?: string;
  type?: string;
  priority?: string;
  assigneeId?: number;
  assigneeName?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface CreateWorkItemInput {
  projectId?: number;
  title: string;
  description?: string | null;
  type: 'todo' | 'issue';
  priority?: 'low' | 'medium' | 'high';
  assigneeId?: number;
  assigneeName?: string;
  dueDate?: string;
}

interface UpdateWorkItemInput {
  title?: string;
  description?: string | null;
  type?: 'todo' | 'issue';
  priority?: 'low' | 'medium' | 'high';
  status?: 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';
  assigneeId?: number | null;
  assigneeName?: string | null;
  dueDate?: string | null;
}

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  private isSuperAdmin(actor?: AuthActor) {
    return this.accessService.normalizeRole(actor?.role) === 'super_admin';
  }

  private requireActorId(actor?: AuthActor) {
    const actorId = Number(actor?.sub);
    if (!actorId) {
      throw new ForbiddenException('Only authenticated users can operate work items');
    }
    return actorId;
  }

  private async assertWorkItemReadAccess(actor: AuthActor | undefined, item: { projectId: number | null; creatorId: number }) {
    if (item.projectId) {
      await this.accessService.assertProjectAccess(actor, item.projectId);
      return;
    }
    if (this.isSuperAdmin(actor)) return;
    const actorId = this.requireActorId(actor);
    if (actorId !== item.creatorId) {
      throw new ForbiddenException('No access to personal work item');
    }
  }

  private async assertWorkItemWriteAccess(actor: AuthActor | undefined, item: { projectId: number | null; creatorId: number }) {
    await this.assertWorkItemReadAccess(actor, item);
  }

  private toDateRank(value: string | null) {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
  }

  private sortItems<T extends { status: WorkItemStatus; priority: WorkItemPriority; dueDate: string | null; updatedAt: Date }>(items: T[]) {
    const statusRank: Record<WorkItemStatus, number> = {
      todo: 0,
      in_progress: 1,
      in_review: 2,
      done: 3,
      closed: 4
    };
    const priorityRank: Record<WorkItemPriority, number> = {
      high: 0,
      medium: 1,
      low: 2
    };

    return items.sort((a, b) => {
      const s = statusRank[a.status] - statusRank[b.status];
      if (s !== 0) return s;

      const p = priorityRank[a.priority] - priorityRank[b.priority];
      if (p !== 0) return p;

      const d = this.toDateRank(a.dueDate) - this.toDateRank(b.dueDate);
      if (d !== 0) return d;

      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }

  async list(actor: AuthActor | undefined, query: ListWorkItemsInput) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize) || 20));
    const actorId = Number(actor?.sub) || null;
    const isSuperAdmin = this.isSuperAdmin(actor);

    const baseFilters: Prisma.WorkItemWhereInput[] = [];
    if (query.status) baseFilters.push({ status: query.status as WorkItemStatus });
    if (query.type) baseFilters.push({ type: query.type as WorkItemType });
    if (query.priority) baseFilters.push({ priority: query.priority as WorkItemPriority });
    if (query.assigneeId) baseFilters.push({ assigneeId: query.assigneeId });
    if (query.assigneeName && query.assigneeName.trim()) {
      baseFilters.push({ assigneeName: query.assigneeName.trim() });
    }
    if (query.search && query.search.trim()) {
      const needle = query.search.trim();
      baseFilters.push({
        OR: [
          { title: { contains: needle, mode: 'insensitive' } },
          { description: { contains: needle, mode: 'insensitive' } },
          { assigneeName: { contains: needle, mode: 'insensitive' } }
        ]
      });
    }

    let scopeWhere: Prisma.WorkItemWhereInput;
    if (query.scope === 'project') {
      if (isSuperAdmin) {
        scopeWhere = query.projectId ? { projectId: query.projectId } : { projectId: { not: null } };
      } else {
        const accessible = await this.accessService.getAccessibleProjectIds(actor);
        const ids = accessible ?? [];
        if (query.projectId) {
          if (!ids.includes(query.projectId)) {
            throw new ForbiddenException(`No access to project ${query.projectId}`);
          }
          scopeWhere = { projectId: query.projectId };
        } else {
          scopeWhere = ids.length > 0 ? { projectId: { in: ids } } : { id: -1 };
        }
      }
    } else if (query.scope === 'personal') {
      if (isSuperAdmin) {
        scopeWhere = { projectId: null };
      } else {
        if (!actorId) {
          throw new ForbiddenException('Only authenticated users can list personal work items');
        }
        scopeWhere = { projectId: null, creatorId: actorId };
      }
    } else {
      if (isSuperAdmin) {
        const ors: Prisma.WorkItemWhereInput[] = [{ projectId: null }, { projectId: { not: null } }];
        if (query.projectId) {
          scopeWhere = { OR: [{ projectId: query.projectId }, { projectId: null }] };
        } else {
          scopeWhere = { OR: ors };
        }
      } else {
        if (!actorId) {
          throw new ForbiddenException('Only authenticated users can list work items');
        }
        const accessible = await this.accessService.getAccessibleProjectIds(actor);
        const projectWhere = query.projectId
          ? { projectId: query.projectId }
          : (accessible && accessible.length > 0 ? { projectId: { in: accessible } } : null);

        if (query.projectId && accessible && !accessible.includes(query.projectId)) {
          throw new ForbiddenException(`No access to project ${query.projectId}`);
        }

        const ors: Prisma.WorkItemWhereInput[] = [{ projectId: null, creatorId: actorId }];
        if (projectWhere) ors.push(projectWhere);
        scopeWhere = { OR: ors };
      }
    }

    const where: Prisma.WorkItemWhereInput = baseFilters.length > 0
      ? { AND: [scopeWhere, ...baseFilters] }
      : scopeWhere;

    const rows = await this.prisma.workItem.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, alias: true } },
        creator: { select: { id: true, name: true, username: true } },
        assignee: { select: { id: true, name: true, username: true } }
      }
    });

    const sorted = this.sortItems(rows);
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  }

  async create(actor: AuthActor | undefined, input: CreateWorkItemInput) {
    const creatorId = this.requireActorId(actor);

    if (input.projectId) {
      await this.accessService.assertProjectAccess(actor, input.projectId);
      const project = await this.prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
      if (!project) throw new NotFoundException('Project not found');
    }

    let assigneeName = input.assigneeName?.trim() || null;
    if (input.assigneeId) {
      const user = await this.prisma.user.findUnique({ where: { id: input.assigneeId }, select: { id: true, name: true } });
      if (!user) throw new NotFoundException('Assignee not found');
      assigneeName = user.name;
    }

    return this.prisma.workItem.create({
      data: {
        projectId: input.projectId ?? null,
        title: input.title,
        description: input.description,
        type: input.type as WorkItemType,
        priority: (input.priority ?? 'medium') as WorkItemPriority,
        status: WorkItemStatus.todo,
        assigneeId: input.assigneeId ?? null,
        assigneeName,
        creatorId,
        dueDate: input.dueDate ?? null
      },
      include: {
        project: { select: { id: true, name: true, alias: true } },
        creator: { select: { id: true, name: true, username: true } },
        assignee: { select: { id: true, name: true, username: true } }
      }
    });
  }

  async update(actor: AuthActor | undefined, id: number, input: UpdateWorkItemInput) {
    const actorId = this.requireActorId(actor);
    const target = await this.prisma.workItem.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        creatorId: true,
        status: true,
        assigneeId: true,
        assigneeName: true,
        description: true,
        dueDate: true
      }
    });
    if (!target) {
      throw new NotFoundException('Work item not found');
    }
    await this.assertWorkItemWriteAccess(actor, target);

    let assigneeName = typeof input.assigneeName === 'undefined' ? undefined : (input.assigneeName?.trim() || null);
    if (input.assigneeId) {
      const user = await this.prisma.user.findUnique({ where: { id: input.assigneeId }, select: { id: true, name: true } });
      if (!user) throw new NotFoundException('Assignee not found');
      assigneeName = user.name;
    }

    const nextData: Prisma.WorkItemUpdateInput = {
      ...(typeof input.title === 'undefined' ? {} : { title: input.title }),
      ...(typeof input.description === 'undefined' ? {} : { description: input.description }),
      ...(typeof input.type === 'undefined' ? {} : { type: input.type as WorkItemType }),
      ...(typeof input.priority === 'undefined' ? {} : { priority: input.priority as WorkItemPriority }),
      ...(typeof input.status === 'undefined' ? {} : { status: input.status as WorkItemStatus }),
      ...(typeof input.assigneeId === 'undefined' ? {} : { assigneeId: input.assigneeId }),
      ...(typeof assigneeName === 'undefined' ? {} : { assigneeName }),
      ...(typeof input.dueDate === 'undefined' ? {} : { dueDate: input.dueDate })
    };

    const histories: Array<{ field: string; beforeValue: string | null; afterValue: string | null }> = [];
    if (typeof input.status !== 'undefined' && input.status !== target.status) {
      histories.push({ field: 'status', beforeValue: target.status, afterValue: input.status });
    }
    const nextAssigneeId = typeof input.assigneeId === 'undefined' ? target.assigneeId : (input.assigneeId ?? null);
    const nextAssigneeName = typeof assigneeName === 'undefined' ? (target.assigneeName ?? null) : assigneeName;
    if (nextAssigneeId !== target.assigneeId || nextAssigneeName !== (target.assigneeName ?? null)) {
      histories.push({
        field: 'assignee',
        beforeValue: target.assigneeName ?? (target.assigneeId == null ? null : String(target.assigneeId)),
        afterValue: nextAssigneeName ?? (nextAssigneeId == null ? null : String(nextAssigneeId))
      });
    }
    if (typeof input.dueDate !== 'undefined' && (input.dueDate ?? null) !== target.dueDate) {
      histories.push({ field: 'dueDate', beforeValue: target.dueDate, afterValue: input.dueDate });
    }
    if (typeof input.description !== 'undefined' && (input.description ?? null) !== (target.description ?? null)) {
      histories.push({
        field: 'description',
        beforeValue: target.description ?? null,
        afterValue: input.description ?? null
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workItem.update({
        where: { id },
        data: nextData,
        include: {
          project: { select: { id: true, name: true, alias: true } },
          creator: { select: { id: true, name: true, username: true } },
          assignee: { select: { id: true, name: true, username: true } }
        }
      });

      if (histories.length > 0) {
        await tx.workItemHistory.createMany({
          data: histories.map((entry) => ({
            workItemId: id,
            field: entry.field as any,
            beforeValue: entry.beforeValue,
            afterValue: entry.afterValue,
            changedById: actorId
          }))
        });
      }

      return updated;
    });
  }

  async remove(actor: AuthActor | undefined, id: number) {
    const target = await this.prisma.workItem.findUnique({
      where: { id },
      select: { id: true, projectId: true, creatorId: true }
    });
    if (!target) {
      throw new NotFoundException('Work item not found');
    }
    await this.assertWorkItemWriteAccess(actor, target);

    await this.prisma.$transaction(async (tx) => {
      await tx.workItemHistory.deleteMany({ where: { workItemId: id } });
      await tx.workItem.delete({ where: { id } });
    });

    return { id };
  }

  async getHistory(actor: AuthActor | undefined, id: number) {
    const target = await this.prisma.workItem.findUnique({
      where: { id },
      select: { id: true, projectId: true, creatorId: true }
    });
    if (!target) {
      throw new NotFoundException('Work item not found');
    }
    await this.assertWorkItemReadAccess(actor, target);

    return this.prisma.workItemHistory.findMany({
      where: { workItemId: id },
      orderBy: { id: 'desc' },
      include: {
        changedBy: {
          select: { id: true, name: true, username: true }
        }
      }
    });
  }
}
