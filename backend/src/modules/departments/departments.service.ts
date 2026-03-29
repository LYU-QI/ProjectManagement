import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FeishuService } from '../feishu/feishu.service';
import { AccessService, AuthActor } from '../access/access.service';

interface CreateDepartmentInput {
  name: string;
  parentId?: string;
  sortOrder?: number;
}

interface UpdateDepartmentInput {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
}

interface DepartmentTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  feishuDeptId: string | null;
  children: DepartmentTreeNode[];
}

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feishuService: FeishuService,
    private readonly accessService: AccessService
  ) {}

  async getDepartmentTree(actor: AuthActor | undefined, organizationId: string) {
    const departments = await this.prisma.department.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    return this.buildTree(departments);
  }

  async getDepartmentById(actor: AuthActor | undefined, id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, username: true } }
          }
        },
        children: { orderBy: { sortOrder: 'asc' } }
      }
    });

    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    return dept;
  }

  async create(actor: AuthActor | undefined, organizationId: string, input: CreateDepartmentInput) {
    return this.prisma.department.create({
      data: {
        name: input.name,
        organizationId,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0
      }
    });
  }

  async update(actor: AuthActor | undefined, id: string, input: UpdateDepartmentInput) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        parentId: input.parentId !== undefined ? input.parentId : existing.parentId,
        sortOrder: input.sortOrder ?? existing.sortOrder
      }
    });
  }

  async delete(actor: AuthActor | undefined, id: string) {
    const children = await this.prisma.department.count({ where: { parentId: id } });
    if (children > 0) {
      throw new BadRequestException('Cannot delete department with child departments');
    }

    await this.prisma.department.updateMany({
      where: { parentId: id },
      data: { parentId: null }
    });

    await this.prisma.orgMember.updateMany({
      where: { departmentId: id },
      data: { departmentId: null }
    });

    return this.prisma.department.delete({ where: { id } });
  }

  async syncFromFeishu(organizationId: string): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    try {
      const feishuDepts = await this.fetchFeishuDepartments();

      for (const dept of feishuDepts) {
        const existing = await this.prisma.department.findFirst({
          where: { organizationId, feishuDeptId: dept.dept_id }
        });

        if (existing) {
          await this.prisma.department.update({
            where: { id: existing.id },
            data: {
              name: dept.name,
              sortOrder: dept.order ?? 0
            }
          });
          updated++;
        } else {
          await this.prisma.department.create({
            data: {
              name: dept.name,
              organizationId,
              feishuDeptId: dept.dept_id,
              parentId: null,
              sortOrder: dept.order ?? 0
            }
          });
          created++;
        }
      }

      // Update parent relationships
      for (const dept of feishuDepts) {
        if (dept.parent_id && dept.parent_id !== '0') {
          const child = await this.prisma.department.findFirst({
            where: { organizationId, feishuDeptId: dept.dept_id }
          });
          const parent = await this.prisma.department.findFirst({
            where: { organizationId, feishuDeptId: dept.parent_id }
          });

          if (child && parent && child.parentId !== parent.id) {
            await this.prisma.department.update({
              where: { id: child.id },
              data: { parentId: parent.id }
            });
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new BadRequestException(`Feishu sync failed: ${message}`);
    }

    return { created, updated };
  }

  private async fetchFeishuDepartments(): Promise<Array<{ dept_id: string; parent_id: string; name: string; order: number }>> {
    const token = await (this.feishuService as any).getTenantAccessToken?.() ?? '';
    const results: Array<{ dept_id: string; parent_id: string; name: string; order: number }> = [];

    const fetchPage = async (parentId?: string) => {
      const params = new URLSearchParams({ fetch_child: 'true', user_id_type: 'open_id' });
      if (parentId) {
        params.set('parent_department_id', parentId);
      }

      const res = await fetch(
        `https://open.feishu.cn/open-apis/contact/v3/departments?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!res.ok) {
        throw new BadRequestException(`Feishu API failed: HTTP ${res.status}`);
      }

      const data = (await res.json()) as { code: number; msg: string; data?: { items?: any[]; page_token?: string; has_more: boolean } };

      if (data.code !== 0) {
        throw new BadRequestException(`Feishu API failed: ${data.code} ${data.msg}`);
      }

      if (data.data?.items) {
        for (const item of data.data.items) {
          results.push({
            dept_id: item.department_id,
            parent_id: item.parent_id ?? '0',
            name: item.name,
            order: item.order ?? 0
          });
        }
      }

      if (data.data?.has_more) {
        const nextToken = data.data.page_token;
        if (nextToken) {
          const nextParams = new URLSearchParams({ page_token: nextToken });
          if (parentId) nextParams.set('parent_department_id', parentId);
          const nextRes = await fetch(
            `https://open.feishu.cn/open-apis/contact/v3/departments?${nextParams.toString()}`,
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
          );
          if (nextRes.ok) {
            const nextData = (await nextRes.json()) as { code: number; data?: { items?: any[] } };
            if (nextData.code === 0 && nextData.data?.items) {
              for (const item of nextData.data.items) {
                results.push({
                  dept_id: item.department_id,
                  parent_id: item.parent_id ?? '0',
                  name: item.name,
                  order: item.order ?? 0
                });
              }
            }
          }
        }
      }
    };

    await fetchPage();
    return results;
  }

  private buildTree(departments: Array<{
    id: string; name: string; parentId: string | null; sortOrder: number; feishuDeptId: string | null;
  }>): DepartmentTreeNode[] {
    const map = new Map<string, DepartmentTreeNode>();
    const roots: DepartmentTreeNode[] = [];

    for (const dept of departments) {
      map.set(dept.id, { ...dept, children: [] });
    }

    for (const dept of departments) {
      const node = map.get(dept.id)!;
      if (dept.parentId && map.has(dept.parentId)) {
        map.get(dept.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
