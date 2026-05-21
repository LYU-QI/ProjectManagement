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

const FIELD_ALIASES = {
  people: {
    personId: '人员ID',
    name: '姓名',
    role: '角色',
    department: '部门',
    level: '职级',
    location: '地点',
    dailyCapacity: '日标准产能',
    status: '状态',
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
            level: this.fieldText(fields, '职级'),
            location: this.fieldText(fields, '地点'),
            dailyCapacity: this.fieldText(fields, '日标准产能') || '1',
            status: this.fieldText(fields, '状态')
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
      roles: this.uniqueFields(rows, ['角色']),
      levels: this.uniqueFields(rows, ['职级']),
      locations: this.uniqueFields(rows, ['地点']),
      statuses: this.uniqueFields(rows, ['状态'], ['在岗', '停用', '离职']),
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
      level: this.text(input.level),
      location: this.text(input.location),
      dailyCapacity: String(this.positiveNumber(input.dailyCapacity, '日标准产能', 1)),
      status: this.text(input.status) || '在岗',
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
    if (['owner', 'admin'].includes(actor?.orgRole ?? '')) return;
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
