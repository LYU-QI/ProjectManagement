import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateWikiPageDto, UpdateWikiPageDto, WikiPageTypeEnum } from './wiki.dto';

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class WikiService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: number) {
    return this.prisma.wikiPage.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async findById(id: number) {
    return this.prisma.wikiPage.findUnique({ where: { id } });
  }

  async create(dto: CreateWikiPageDto, creatorId?: number) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new BadRequestException(`项目不存在: ${dto.projectId}`);

    // Validate parent belongs to same project
    if (dto.parentId) {
      const parent = await this.prisma.wikiPage.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException(`父页面不存在: ${dto.parentId}`);
      if (parent.projectId !== dto.projectId) {
        throw new BadRequestException('父页面必须属于同一项目');
      }
    }

    // Auto-generate slug
    const baseSlug = toKebabCase(dto.title);
    const slug = baseSlug || `page-${Date.now()}`;

    // Default sortOrder to max+1
    const maxOrder = await this.prisma.wikiPage.aggregate({
      where: {
        projectId: dto.projectId,
        parentId: dto.parentId ?? null,
      },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.wikiPage.create({
      data: {
        projectId: dto.projectId,
        organizationId: project.organizationId,
        parentId: dto.parentId ?? null,
        title: dto.title,
        content: dto.content ?? '',
        type: dto.type ?? WikiPageTypeEnum.document,
        slug,
        sortOrder,
        creatorId: creatorId ?? null,
      },
    });
  }

  async update(id: number, dto: UpdateWikiPageDto) {
    const page = await this.prisma.wikiPage.findUnique({ where: { id } });
    if (!page) throw new BadRequestException(`页面不存在: ${id}`);

    // Validate parent belongs to same project
    if (dto.parentId !== undefined && dto.parentId !== null) {
      const parent = await this.prisma.wikiPage.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException(`父页面不存在: ${dto.parentId}`);
      if (parent.projectId !== page.projectId) {
        throw new BadRequestException('父页面必须属于同一项目');
      }
      if (parent.id === id) {
        throw new BadRequestException('页面不能是自己的父页面');
      }
    }

    const slug = dto.title ? (toKebabCase(dto.title) || `page-${id}`) : page.slug;

    return this.prisma.wikiPage.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        slug,
      },
    });
  }

  async delete(id: number) {
    const page = await this.prisma.wikiPage.findUnique({ where: { id } });
    if (!page) throw new BadRequestException(`页面不存在: ${id}`);

    // Cascade delete children (Prisma handles this with the self-relation onDelete)
    await this.prisma.wikiPage.delete({ where: { id } });
    return { id };
  }
}
