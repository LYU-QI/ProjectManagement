import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditableRequest } from '../../audit/audit.types';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../cache/cache.service';
import { ConfigService } from '../config/config.service';
import { FeishuService } from '../feishu/feishu.service';

type ResourceTableKind = 'people' | 'allocations' | 'availability';
type ResourceConfig = { appToken: string; tableId: string; viewId?: string };

type Actor = {
  organizationId?: string | null;
  sub?: number;
  role?: string;
  orgRole?: string | null;
};

type DepartmentSyncStatus = 'matched' | 'pending' | 'system_unassigned' | 'unmatched';

type DepartmentSyncPreviewItem = {
  recordId: string;
  personId: string;
  name: string;
  feishuDepartment: string;
  systemDepartment: string;
  status: DepartmentSyncStatus;
  message: string;
};

type DepartmentSyncSummary = {
  total: number;
  matched: number;
  pending: number;
  systemUnassigned: number;
  unmatched: number;
  updated?: number;
  createdDepartments?: number;
};

const FIELD_ALIASES = {
  people: {
    personId: '人员ID',
    name: '姓名',
    role: '角色',
    department: '部门',
    skillTags: '技能标签',
    level: '职级',
    location: '地点',
    dailyCapacity: '日标准产能',
    status: '状态',
    isKeyResource: '是否关键资源',
    resourceStatus: '资源状态',
    remark: '备注'
  },
  allocations: {
    allocationId: '分配ID',
    personId: '人员ID',
    name: '姓名',
    projectId: '项目ID',
    projectName: '项目名称',
    role: '角色',
    startDate: '开始日期',
    endDate: '结束时间',
    allocationPercent: '投入比例',
    allocationDays: '投入人天',
    allocationType: '分配类型',
    allocationConfirmStatus: '分配确认状态',
    remark: '备注'
  },
  availability: {
    availabilityId: '记录ID',
    personId: '人员ID',
    name: '姓名',
    date: '日期',
    availablePercent: '可用比例',
    availabilityType: '不可用类型',
    reason: '原因',
    remark: '备注'
  }
} as const;

@Injectable()
export class ResourceMaintenanceService {
  constructor(
    private readonly configService: ConfigService,
    private readonly feishuService: FeishuService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService
  ) {}

  async options(actor?: Actor) {
    this.assertCanMaintain(actor);
    const [people, allocations, availability, projects] = await Promise.all([
      this.safeList('people', actor),
      this.safeList('allocations', actor),
      this.safeList('availability', actor),
      this.prisma.project.findMany({
        where: actor?.organizationId ? { organizationId: actor.organizationId } : undefined,
        orderBy: { id: 'asc' },
        select: { id: true, name: true, alias: true, startDate: true, endDate: true }
      })
    ]);
    const rows = [
      ...people.items.map((item) => item.fields),
      ...allocations.items.map((item) => item.fields),
      ...availability.items.map((item) => item.fields)
    ];
    return {
      generatedAt: new Date().toISOString(),
      people: people.items
        .map((item) => {
          const fields = item.fields;
          const personId = this.fieldText(fields, '人员ID');
          const name = this.fieldText(fields, '姓名');
          if (!personId || !name) return null;
          return {
            personId,
            name,
            role: this.fieldText(fields, '角色'),
            department: this.fieldText(fields, '部门'),
            skillTags: this.fieldText(fields, '技能标签'),
            level: this.fieldText(fields, '职级'),
            location: this.fieldText(fields, '地点'),
            dailyCapacity: this.fieldText(fields, '日标准产能') || '1',
            status: this.fieldText(fields, '状态'),
            isKeyResource: this.fieldText(fields, '是否关键资源'),
            resourceStatus: this.fieldText(fields, '资源状态')
          };
        })
        .filter(Boolean),
      projects: projects.map((project) => ({
        projectId: String(project.id),
        projectName: project.name,
        alias: project.alias || '',
        startDate: this.dateString(project.startDate),
        endDate: this.dateString(project.endDate)
      })),
      departments: this.uniqueFields(rows, ['部门']),
      systemDepartments: await this.systemDepartmentOptions(actor?.organizationId ?? undefined),
      roles: this.uniqueFields(rows, ['角色']),
      levels: this.uniqueFields(rows, ['职级']),
      locations: this.uniqueFields(rows, ['地点']),
      statuses: this.uniqueFields(rows, ['状态'], ['在岗', '停用', '离职']),
      skillTags: this.uniqueFields(rows, ['技能标签']),
      resourceStatuses: this.uniqueFields(rows, ['资源状态'], ['可用', '部分可用', '不可用']),
      keyResourceOptions: this.uniqueFields(rows, ['是否关键资源'], ['是', '否']),
      allocationConfirmStatuses: this.uniqueFields(rows, ['分配确认状态'], ['草稿', '已确认', '待调整']),
      allocationTypes: this.uniqueFields(rows, ['分配类型'], ['项目投入', '售前支持', '研发支持', '测试支持']),
      availabilityTypes: this.uniqueFields(rows, ['不可用类型'], ['请假', '出差', '培训', '节假日', '临时占用'])
    };
  }

  async listPeople(actor?: Actor) {
    this.assertCanMaintain(actor);
    return this.list('people', actor);
  }

  async createPerson(actor: Actor | undefined, input: Record<string, unknown>, req?: AuditableRequest) {
    this.assertCanMaintain(actor);
    return this.create('people', actor, this.personFields(input), req);
  }

  async updatePerson(actor: Actor | undefined, recordId: string, input: Record<string, unknown>, req?: AuditableRequest) {
    this.assertCanMaintain(actor);
    return this.update('people', actor, recordId, this.personFields(input), req);
  }

  async listAllocations(actor?: Actor) {
    this.assertCanMaintain(actor);
    return this.list('allocations', actor);
  }

  async createAllocation(actor: Actor | undefined, input: Record<string, unknown>, req?: AuditableRequest) {
    this.assertCanMaintain(actor);
    return this.create('allocations', actor, this.allocationFields(input), req);
  }

  async updateAllocation(actor: Actor | undefined, recordId: string, input: Record<string, unknown>, req?: AuditableRequest) {
    this.assertCanMaintain(actor);
    return this.update('allocations', actor, recordId, this.allocationFields(input), req);
  }

  async listAvailability(actor?: Actor) {
    this.assertCanMaintain(actor);
    return this.list('availability', actor);
  }

  async createAvailability(actor: Actor | undefined, input: Record<string, unknown>, req?: AuditableRequest) {
    this.assertCanMaintain(actor);
    return this.create('availability', actor, this.availabilityFields(input), req);
  }

  async updateAvailability(actor: Actor | undefined, recordId: string, input: Record<string, unknown>, req?: AuditableRequest) {
    this.assertCanMaintain(actor);
    return this.update('availability', actor, recordId, this.availabilityFields(input), req);
  }

  async previewDepartmentSync(actor?: Actor) {
    this.assertCanMaintain(actor);
    return this.buildDepartmentSyncPreview(actor);
  }

  async syncSystemDepartmentsToFeishu(actor?: Actor, req?: AuditableRequest) {
    this.assertCanMaintain(actor);
    const config = await this.getTableConfig('people', actor?.organizationId ?? undefined);
    const preview = await this.buildDepartmentSyncPreview(actor);
    const targets = preview.items.filter((item) => item.status === 'pending' && item.systemDepartment);
    const results: Array<{ recordId: string; personId: string; name: string; status: 'success' | 'failed'; message: string }> = [];

    for (const item of targets) {
      try {
        await this.feishuService.updateRecord(item.recordId, this.pickFields('people', { department: item.systemDepartment }), {
          appToken: config.appToken,
          tableId: config.tableId
        });
        results.push({ recordId: item.recordId, personId: item.personId, name: item.name, status: 'success', message: '已同步到飞书' });
      } catch (err) {
        results.push({
          recordId: item.recordId,
          personId: item.personId,
          name: item.name,
          status: 'failed',
          message: err instanceof Error ? err.message : '飞书更新失败'
        });
      }
    }

    await this.invalidateResourceCalendarCache(actor);
    const summary = {
      ...preview.summary,
      updated: results.filter((item) => item.status === 'success').length
    };
    this.setAudit(req, 'department_sync.system_to_feishu', undefined, { summary, results: results.slice(0, 100) });
    return { summary, results, preview };
  }

  async fillSystemDepartmentsFromFeishu(actor?: Actor, req?: AuditableRequest) {
    this.assertCanMaintain(actor);
    const organizationId = actor?.organizationId;
    if (!organizationId) throw new BadRequestException('缺少当前组织上下文');

    const people = await this.list('people', actor);
    const members = await this.prisma.orgMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true, username: true } } }
    });
    const memberByName = new Map(members.map((member) => [this.normalizeKey(member.user.name), member]));
    let createdDepartments = 0;
    const results: Array<{ personId: string; name: string; department: string; status: 'success' | 'failed' | 'skipped'; message: string }> = [];

    for (const row of people.items) {
      const personId = this.fieldText(row.fields, FIELD_ALIASES.people.personId);
      const name = this.fieldText(row.fields, FIELD_ALIASES.people.name);
      const department = this.fieldText(row.fields, FIELD_ALIASES.people.department);
      if (!name || !department) {
        results.push({ personId, name, department, status: 'skipped', message: '缺少姓名或部门' });
        continue;
      }
      const member = memberByName.get(this.normalizeKey(name));
      if (!member) {
        results.push({ personId, name, department, status: 'failed', message: '飞书姓名未匹配到系统姓名' });
        continue;
      }
      if (member.departmentId) {
        results.push({ personId, name, department, status: 'skipped', message: '系统成员已有部门，未覆盖' });
        continue;
      }
      try {
        const before = await this.prisma.department.count({ where: { organizationId } });
        const departmentId = await this.ensureDepartmentPath(organizationId, department);
        const after = await this.prisma.department.count({ where: { organizationId } });
        createdDepartments += Math.max(0, after - before);
        await this.prisma.orgMember.update({
          where: { userId_organizationId: { userId: member.userId, organizationId } },
          data: { departmentId }
        });
        results.push({ personId, name, department, status: 'success', message: '已补齐系统部门' });
      } catch (err) {
        results.push({
          personId,
          name,
          department,
          status: 'failed',
          message: err instanceof Error ? err.message : '补齐系统部门失败'
        });
      }
    }

    await this.invalidateResourceCalendarCache(actor);
    const summary = {
      total: people.items.length,
      updated: results.filter((item) => item.status === 'success').length,
      failed: results.filter((item) => item.status === 'failed').length,
      skipped: results.filter((item) => item.status === 'skipped').length,
      createdDepartments
    };
    this.setAudit(req, 'department_sync.feishu_to_system', undefined, { summary, results: results.slice(0, 100) });
    return { summary, results };
  }

  private async list(kind: ResourceTableKind, actor?: Actor) {
    const config = await this.getTableConfig(kind, actor?.organizationId ?? undefined);
    const data = await this.feishuService.listRecords({
      pageSize: 500,
      viewId: config.viewId,
      opts: { appToken: config.appToken, tableId: config.tableId }
    });
    return {
      generatedAt: new Date().toISOString(),
      items: (data.items || []).map((record: any) => ({
        recordId: record.record_id || record.recordId || record.id,
        fields: record.fields || {}
      }))
    };
  }

  private async safeList(kind: ResourceTableKind, actor?: Actor) {
    try {
      return await this.list(kind, actor);
    } catch {
      return { generatedAt: new Date().toISOString(), items: [] as Array<{ recordId: string; fields: Record<string, unknown> }> };
    }
  }

  private async create(kind: ResourceTableKind, actor: Actor | undefined, fields: Record<string, unknown>, req?: AuditableRequest) {
    const config = await this.getTableConfig(kind, actor?.organizationId ?? undefined);
    this.setAudit(req, `${kind}.create`, undefined, fields);
    const result = await this.feishuService.createRecord(fields, { appToken: config.appToken, tableId: config.tableId });
    await this.invalidateResourceCalendarCache(actor);
    return { ok: true, result };
  }

  private async update(kind: ResourceTableKind, actor: Actor | undefined, recordId: string, fields: Record<string, unknown>, req?: AuditableRequest) {
    if (!recordId?.trim()) throw new BadRequestException('recordId is required');
    const config = await this.getTableConfig(kind, actor?.organizationId ?? undefined);
    let beforeSnapshot: Prisma.InputJsonValue | undefined;
    try {
      const before = await this.feishuService.getRecord(recordId, { appToken: config.appToken, tableId: config.tableId });
      beforeSnapshot = before as unknown as Prisma.InputJsonValue;
    } catch {
      beforeSnapshot = undefined;
    }
    this.setAudit(req, `${kind}.update`, beforeSnapshot, { recordId, fields });
    const result = await this.feishuService.updateRecord(recordId, fields, { appToken: config.appToken, tableId: config.tableId });
    await this.invalidateResourceCalendarCache(actor);
    return { ok: true, result };
  }

  private async getTableConfig(kind: ResourceTableKind, organizationId?: string): Promise<ResourceConfig> {
    const prefix = kind === 'people'
      ? 'RESOURCE_CALENDAR_PEOPLE'
      : kind === 'allocations'
        ? 'RESOURCE_CALENDAR_ALLOCATIONS'
        : 'RESOURCE_CALENDAR_AVAILABILITY';
    const appToken = await this.configService.get(`${prefix}_APP_TOKEN`, organizationId);
    const tableId = await this.configService.get(`${prefix}_TABLE_ID`, organizationId);
    const viewId = await this.configService.get(`${prefix}_VIEW_ID`, organizationId);
    if (!appToken || !tableId) {
      throw new BadRequestException(`缺少 ${prefix}_APP_TOKEN 或 ${prefix}_TABLE_ID，请先在系统设置中配置资源日历飞书表。`);
    }
    return { appToken, tableId, viewId: viewId || undefined };
  }

  private personFields(input: Record<string, unknown>) {
    const personId = this.requiredText(input.personId, '人员ID');
    const name = this.requiredText(input.name, '姓名');
    return this.pickFields('people', {
      personId,
      name,
      role: this.requiredText(input.role, '角色'),
      department: this.requiredText(input.department, '部门'),
      skillTags: this.text(input.skillTags),
      level: this.text(input.level),
      location: this.text(input.location),
      dailyCapacity: String(this.positiveNumber(input.dailyCapacity, '日标准产能', 1)),
      status: this.text(input.status) || '在岗',
      isKeyResource: this.text(input.isKeyResource),
      resourceStatus: this.text(input.resourceStatus),
      remark: this.text(input.remark)
    });
  }

  private allocationFields(input: Record<string, unknown>) {
    const startDate = this.dateMs(input.startDate, '开始日期');
    const endDate = this.dateMs(input.endDate, '结束时间');
    if (endDate < startDate) throw new BadRequestException('结束时间不能早于开始日期');
    const allocationDays = this.positiveNumber(input.allocationDays, '投入人天', 0);
    const dailyCapacity = this.positiveNumber(input.dailyCapacity, '日标准产能', 1);
    const allocationPercent = allocationDays > 0
      ? this.allocationPercentFromDays(allocationDays, startDate, endDate, dailyCapacity)
      : this.percent(input.allocationPercent, '投入比例');
    const projectName = this.requiredText(input.projectName, '项目名称');
    const personId = this.requiredText(input.personId, '人员ID');
    const projectId = this.text(input.projectId) || this.temporaryProjectId(projectName);
    return this.pickFields('allocations', {
      allocationId: this.text(input.allocationId) || this.generatedId('ALLOC', projectId, personId, startDate),
      personId,
      name: this.requiredText(input.name, '姓名'),
      projectId,
      projectName,
      role: this.requiredText(input.role, '角色'),
      startDate,
      endDate,
      allocationPercent,
      allocationDays: String(allocationDays),
      allocationType: this.text(input.allocationType),
      allocationConfirmStatus: this.text(input.allocationConfirmStatus),
      remark: this.text(input.remark)
    });
  }

  private availabilityFields(input: Record<string, unknown>) {
    const personId = this.requiredText(input.personId, '人员ID');
    const date = this.dateMs(input.date, '日期');
    return this.pickFields('availability', {
      availabilityId: this.text(input.availabilityId) || this.generatedId('AVL', personId, '', date),
      personId,
      name: this.requiredText(input.name, '姓名'),
      date,
      availablePercent: this.percent(input.availablePercent, '可用比例'),
      availabilityType: this.requiredText(input.availabilityType, '不可用类型'),
      reason: this.text(input.reason),
      remark: this.text(input.remark)
    });
  }

  private pickFields(kind: ResourceTableKind, values: Record<string, unknown>) {
    const aliases = FIELD_ALIASES[kind] as Record<string, string>;
    return Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [aliases[key] || key, value])
    );
  }

  private requiredText(value: unknown, label: string) {
    const text = this.text(value);
    if (!text) throw new BadRequestException(`${label}不能为空`);
    return text;
  }

  private text(value: unknown) {
    return String(value ?? '').trim();
  }

  private dateString(value: unknown) {
    const text = this.text(value);
    if (!text) return '';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text.slice(0, 10);
    return date.toISOString().slice(0, 10);
  }

  private fieldText(fields: Record<string, unknown>, key: string) {
    const value = fields?.[key];
    if (Array.isArray(value)) {
      return value.map((item) => this.text(item)).filter(Boolean).join(',');
    }
    if (value && typeof value === 'object') {
      const item = value as Record<string, unknown>;
      return this.text(item.text || item.name || item.value);
    }
    return this.text(value);
  }

  private uniqueFields(rows: Array<Record<string, unknown>>, keys: string[], defaults: string[] = []) {
    const values = new Set(defaults.filter(Boolean));
    for (const row of rows) {
      for (const key of keys) {
        const value = this.fieldText(row, key);
        if (value) values.add(value);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }

  private normalizeKey(value: unknown) {
    return this.text(value).toLowerCase();
  }

  private normalizeDepartmentPath(value: unknown) {
    return this.text(value).replace(/\\/g, '/').replace(/＞|>/g, '/').replace(/\s*\/\s*/g, ' / ');
  }

  private async systemDepartmentOptions(organizationId?: string) {
    if (!organizationId) return [];
    const departments = await this.prisma.department.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, parentId: true }
    });
    return this.flattenDepartmentPaths(departments).map((item) => item.path);
  }

  private flattenDepartmentPaths(departments: Array<{ id: string; name: string; parentId: string | null }>) {
    const byParent = new Map<string | null, Array<{ id: string; name: string; parentId: string | null }>>();
    for (const department of departments) {
      const siblings = byParent.get(department.parentId) ?? [];
      siblings.push(department);
      byParent.set(department.parentId, siblings);
    }
    for (const siblings of byParent.values()) {
      siblings.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }
    const output: Array<{ id: string; path: string }> = [];
    const visit = (parentId: string | null, prefix: string) => {
      for (const department of byParent.get(parentId) ?? []) {
        const path = prefix ? `${prefix} / ${department.name}` : department.name;
        output.push({ id: department.id, path });
        visit(department.id, path);
      }
    };
    visit(null, '');
    return output;
  }

  private async systemMemberDepartmentMap(organizationId?: string | null) {
    if (!organizationId) return new Map<string, { departmentId: string | null; departmentPath: string; userId: number; name: string; duplicate: boolean }>();
    const [members, departments] = await Promise.all([
      this.prisma.orgMember.findMany({
        where: { organizationId },
        include: { user: { select: { id: true, name: true, username: true } } }
      }),
      this.prisma.department.findMany({
        where: { organizationId },
        select: { id: true, name: true, parentId: true }
      })
    ]);
    const pathById = new Map(this.flattenDepartmentPaths(departments).map((item) => [item.id, item.path]));
    const grouped = new Map<string, Array<{ departmentId: string | null; departmentPath: string; userId: number; name: string }>>();
    for (const member of members) {
      const userName = this.normalizeKey(member.user.name);
      if (!userName) continue;
      const list = grouped.get(userName) ?? [];
      list.push({
        userId: member.userId,
        name: member.user.name,
        departmentId: member.departmentId,
        departmentPath: member.departmentId ? pathById.get(member.departmentId) ?? '' : ''
      });
      grouped.set(userName, list);
    }
    const map = new Map<string, { departmentId: string | null; departmentPath: string; userId: number; name: string; duplicate: boolean }>();
    for (const [name, list] of grouped) {
      if (list.length > 1) {
        map.set(name, { ...list[0], duplicate: true });
      } else {
        map.set(name, { ...list[0], duplicate: false });
      }
    }
    return map;
  }

  private async buildDepartmentSyncPreview(actor?: Actor): Promise<{ summary: DepartmentSyncSummary; items: DepartmentSyncPreviewItem[] }> {
    const [people, memberMap] = await Promise.all([
      this.list('people', actor),
      this.systemMemberDepartmentMap(actor?.organizationId)
    ]);
    const items: DepartmentSyncPreviewItem[] = people.items.map((row) => {
      const personId = this.fieldText(row.fields, FIELD_ALIASES.people.personId);
      const name = this.fieldText(row.fields, FIELD_ALIASES.people.name);
      const feishuDepartment = this.normalizeDepartmentPath(this.fieldText(row.fields, FIELD_ALIASES.people.department));
      const member = memberMap.get(this.normalizeKey(name));
      if (!member) {
        return {
          recordId: row.recordId,
          personId,
          name,
          feishuDepartment,
          systemDepartment: '',
          status: 'unmatched',
          message: '飞书姓名未匹配到系统姓名'
        };
      }
      if (member.duplicate) {
        return {
          recordId: row.recordId,
          personId,
          name,
          feishuDepartment,
          systemDepartment: '',
          status: 'unmatched',
          message: '系统中存在同名成员，请先消除重名或改用更明确的匹配规则'
        };
      }
      const systemDepartment = this.normalizeDepartmentPath(member.departmentPath);
      if (!systemDepartment) {
        return {
          recordId: row.recordId,
          personId,
          name,
          feishuDepartment,
          systemDepartment,
          status: 'system_unassigned',
          message: '系统成员未分配部门，未覆盖飞书'
        };
      }
      if (this.normalizeDepartmentPath(feishuDepartment) === systemDepartment) {
        return {
          recordId: row.recordId,
          personId,
          name,
          feishuDepartment,
          systemDepartment,
          status: 'matched',
          message: '部门一致'
        };
      }
      return {
        recordId: row.recordId,
        personId,
        name,
        feishuDepartment,
        systemDepartment,
        status: 'pending',
        message: '系统部门将覆盖飞书部门'
      };
    });
    const summary: DepartmentSyncSummary = {
      total: items.length,
      matched: items.filter((item) => item.status === 'matched').length,
      pending: items.filter((item) => item.status === 'pending').length,
      systemUnassigned: items.filter((item) => item.status === 'system_unassigned').length,
      unmatched: items.filter((item) => item.status === 'unmatched').length
    };
    return { summary, items };
  }

  private async ensureDepartmentPath(organizationId: string, rawPath: string) {
    const parts = this.normalizeDepartmentPath(rawPath).split('/').map((item) => item.trim()).filter(Boolean);
    if (parts.length === 0) throw new BadRequestException('部门不能为空');
    let parentId: string | null = null;
    let currentId = '';
    for (const part of parts) {
      const existing = await this.prisma.department.findFirst({
        where: { organizationId, parentId, name: part },
        select: { id: true }
      });
      if (existing) {
        currentId = existing.id;
      } else {
        const created = await this.prisma.department.create({
          data: { organizationId, parentId, name: part, sortOrder: 0 },
          select: { id: true }
        });
        currentId = created.id;
      }
      parentId = currentId;
    }
    return currentId;
  }

  private generatedId(prefix: string, partA: string, partB: string, dateMs: number) {
    const date = new Date(dateMs).toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return [prefix, this.idPart(partA), this.idPart(partB), date, random].filter(Boolean).join('-');
  }

  private idPart(value: string) {
    return this.text(value).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').slice(0, 24) || 'NA';
  }

  private temporaryProjectId(projectName: string) {
    return `TEMP-${this.idPart(projectName)}`;
  }

  private positiveNumber(value: unknown, label: string, fallback: number) {
    if (value === undefined || value === null || value === '') return fallback;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) throw new BadRequestException(`${label}必须是非负数字`);
    return num;
  }

  private percent(value: unknown, label: string) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || num > 200) {
      throw new BadRequestException(`${label}必须在 0-200 之间`);
    }
    return num;
  }

  private allocationPercentFromDays(allocationDays: number, startDate: number, endDate: number, dailyCapacity: number) {
    const days = Math.floor((endDate - startDate) / 86_400_000) + 1;
    if (days <= 0) throw new BadRequestException('投入周期必须至少包含 1 天');
    if (dailyCapacity <= 0) throw new BadRequestException('日标准产能必须大于 0');
    const percent = Math.round((allocationDays / days / dailyCapacity) * 10000) / 100;
    if (percent < 0 || percent > 200) {
      throw new BadRequestException('按投入人天反算后的投入比例必须在 0-200 之间');
    }
    return percent;
  }

  private dateMs(value: unknown, label: string) {
    const text = this.requiredText(value, label);
    const date = new Date(`${text.slice(0, 10)}T00:00:00+08:00`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label}格式不正确`);
    return date.getTime();
  }

  private async invalidateResourceCalendarCache(actor?: Actor) {
    await this.redisService.del(`dashboard:resource-calendar:v2:${actor?.organizationId ?? 'global'}`);
  }

  private assertCanMaintain(actor?: Actor) {
    if (['super_admin', 'project_manager', 'dept_head'].includes(actor?.role ?? '')) return;
    throw new ForbiddenException('无权访问资源维护台');
  }

  private setAudit(req: AuditableRequest | undefined, source: string, beforeSnapshot?: Prisma.InputJsonValue, afterSnapshot?: unknown) {
    if (!req) return;
    req.auditMeta = {
      ...(req.auditMeta ?? {}),
      source: `resource_maintenance.${source}`,
      beforeSnapshot,
      afterSnapshot: afterSnapshot as Prisma.InputJsonValue
    };
  }
}
