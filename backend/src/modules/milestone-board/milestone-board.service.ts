import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';

interface CreateItemInput {
  projectId: number;
  title: string;
  owner: string;
  due: string;
  status?: 'upcoming' | 'in_progress' | 'completed';
  risk?: 'low' | 'medium' | 'high';
  progress?: number;
  deliverables?: Array<{ content: string; done?: boolean }>;
}

interface UpdateItemInput {
  title?: string;
  owner?: string;
  due?: string;
  status?: 'upcoming' | 'in_progress' | 'completed';
  risk?: 'low' | 'medium' | 'high';
  progress?: number;
}

interface ImportItem {
  title: string;
  owner: string;
  due: string;
  status?: string;
  risk?: string;
  progress?: number;
  deliverables?: Array<{ content: string; done?: boolean }>;
}

interface ImportInput {
  migrationToken?: string;
  items: ImportItem[];
}

@Injectable()
export class MilestoneBoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService
  ) {}

  async listByProject(actor: AuthActor | undefined, projectId: number) {
    await this.accessService.assertProjectAccess(actor, projectId);
    const items = await this.prisma.milestoneBoardItem.findMany({
      where: { projectId },
      include: { deliverables: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' }
    });
    return { items };
  }

  async create(actor: AuthActor | undefined, input: CreateItemInput) {
    await this.accessService.assertProjectAccess(actor, input.projectId);
    const project = await this.prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const maxOrder = await this.prisma.milestoneBoardItem.aggregate({
      where: { projectId: input.projectId },
      _max: { sortOrder: true }
    });

    const item = await this.prisma.milestoneBoardItem.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        owner: input.owner,
        due: input.due,
        status: input.status ?? 'upcoming',
        risk: input.risk ?? 'low',
        progress: input.progress ?? 0,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        deliverables: input.deliverables
          ? {
              create: input.deliverables.map((d, i) => ({
                content: d.content,
                done: d.done ?? false,
                sortOrder: i
              }))
            }
          : undefined
      },
      include: { deliverables: { orderBy: { sortOrder: 'asc' } } }
    });

    return item;
  }

  async update(actor: AuthActor | undefined, id: number, input: UpdateItemInput) {
    const target = await this.prisma.milestoneBoardItem.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Milestone not found');
    await this.accessService.assertProjectAccess(actor, target.projectId);

    return this.prisma.milestoneBoardItem.update({
      where: { id },
      data: input,
      include: { deliverables: { orderBy: { sortOrder: 'asc' } } }
    });
  }

  async remove(actor: AuthActor | undefined, id: number) {
    const target = await this.prisma.milestoneBoardItem.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Milestone not found');
    await this.accessService.assertProjectAccess(actor, target.projectId);
    await this.prisma.milestoneBoardItem.delete({ where: { id } });
    return { id };
  }

  async addDeliverable(actor: AuthActor | undefined, milestoneId: number, content: string) {
    const target = await this.prisma.milestoneBoardItem.findUnique({ where: { id: milestoneId } });
    if (!target) throw new NotFoundException('Milestone not found');
    await this.accessService.assertProjectAccess(actor, target.projectId);

    const maxOrder = await this.prisma.milestoneBoardDeliverable.aggregate({
      where: { milestoneId },
      _max: { sortOrder: true }
    });

    return this.prisma.milestoneBoardDeliverable.create({
      data: { milestoneId, content, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 }
    });
  }

  async updateDeliverable(actor: AuthActor | undefined, id: number, input: { content?: string; done?: boolean }) {
    const deliverable = await this.prisma.milestoneBoardDeliverable.findUnique({ where: { id } });
    if (!deliverable) throw new NotFoundException('Deliverable not found');

    const milestone = await this.prisma.milestoneBoardItem.findUnique({
      where: { id: deliverable.milestoneId },
      select: { projectId: true }
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    await this.accessService.assertProjectAccess(actor, milestone.projectId);

    return this.prisma.milestoneBoardDeliverable.update({
      where: { id },
      data: input
    });
  }

  async removeDeliverable(actor: AuthActor | undefined, id: number) {
    const deliverable = await this.prisma.milestoneBoardDeliverable.findUnique({ where: { id } });
    if (!deliverable) throw new NotFoundException('Deliverable not found');

    const milestone = await this.prisma.milestoneBoardItem.findUnique({
      where: { id: deliverable.milestoneId },
      select: { projectId: true }
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    await this.accessService.assertProjectAccess(actor, milestone.projectId);

    await this.prisma.milestoneBoardDeliverable.delete({ where: { id } });
    return { id };
  }

  async importLocal(actor: AuthActor | undefined, projectId: number, input: ImportInput) {
    await this.accessService.assertProjectAccess(actor, projectId);

    const maxOrder = await this.prisma.milestoneBoardItem.aggregate({
      where: { projectId },
      _max: { sortOrder: true }
    });
    let sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    for (const item of input.items) {
      await this.prisma.milestoneBoardItem.create({
        data: {
          projectId,
          title: item.title,
          owner: item.owner,
          due: item.due,
          status: (item.status as 'upcoming' | 'in_progress' | 'completed') ?? 'upcoming',
          risk: (item.risk as 'low' | 'medium' | 'high') ?? 'low',
          progress: item.progress ?? 0,
          sortOrder: sortOrder++,
          deliverables: item.deliverables
            ? {
                create: item.deliverables.map((d, i) => ({
                  content: d.content,
                  done: d.done ?? false,
                  sortOrder: i
                }))
              }
            : undefined
        }
      });
    }

    return { imported: input.items.length };
  }
}
