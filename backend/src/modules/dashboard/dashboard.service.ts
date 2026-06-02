import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { BugStatus, RequirementStatus, TaskStatus, WorkItemStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService, AuthActor } from '../access/access.service';
import { RedisService } from '../cache/cache.service';
import { ConfigService } from '../config/config.service';
import { FeishuService } from '../feishu/feishu.service';

type ClusterRiskLight = '红灯' | '黄灯' | '绿灯' | '未填';

type ClusterRiskBoardItem = {
  recordId: string;
  index: string;
  projectName: string;
  projectId: string;
  ownerOne: string;
  pm: string;
  ownerPm: string;
  riskLight: ClusterRiskLight;
  deliveryScope: string;
  hasKeyDemo: boolean | null;
  weeklyProgress: string;
  dailyRiskHelp: string;
  riskResolution: string;
  qualityGap: string;
  qualityLevel: string;
};

type ClusterRiskBoardResponse = {
  generatedAt: string;
  source: 'feishu' | 'config_missing' | 'error';
  error?: string;
  summary: {
    totalProjects: number;
    redCount: number;
    yellowCount: number;
    greenCount: number;
    emptyRiskCount: number;
    keyDemoCount: number;
    dailyRiskHelpCount: number;
    highQualityRiskCount: number;
  };
  items: ClusterRiskBoardItem[];
};

type DeliveryRoadmapSource = 'feishu' | 'config_missing' | 'error';

type DeliveryRoadmapQuarter = {
  key: string;
  year: number;
  quarter: number;
  label: string;
  start: string;
  end: string;
};

type DeliveryRoadmapItem = {
  id: string;
  categoryL1: string;
  categoryL2: string;
  ySortOrder: number;
  targetDate: string;
  targetQuarter: string;
  isTbd: boolean;
  milestoneName: string;
  techDetail: string;
  iconStyle: string;
  hasFlag: boolean;
  deliveryStatus: string;
  vehicleOwner: string;
  riskLevel: string;
  keyRisk: string;
  latestProgress: string;
  nextAction: string;
  dependencies: string;
  updatedAt: string;
  laneId: string;
  xPercent: number;
};

type DeliveryRoadmapLane = {
  id: string;
  categoryL1: string;
  categoryL2: string;
  ySortOrder: number;
  items: DeliveryRoadmapItem[];
};

type DeliveryRoadmapLegendItem = {
  iconStyle: string;
  label: string;
  color: string;
};

type DeliveryRoadmapResponse = {
  generatedAt: string;
  source: DeliveryRoadmapSource;
  error?: string;
  timeAxis: {
    years: number[];
    quarters: DeliveryRoadmapQuarter[];
    startDate: string;
    endDate: string;
  };
  lanes: DeliveryRoadmapLane[];
  items: DeliveryRoadmapItem[];
  legend: DeliveryRoadmapLegendItem[];
};

type ResourceCalendarSource = 'feishu' | 'config_missing' | 'error';
type ResourceLoadStatus = 'idle' | 'normal' | 'saturated' | 'overloaded' | 'unavailable';

type ResourcePerson = {
  id: string;
  personId: string;
  name: string;
  department: string;
  role: string;
  level: string;
  location: string;
  dailyCapacity: number;
  status: string;
  remark: string;
};

type ResourceAllocation = {
  id: string;
  personId: string;
  name: string;
  projectId: string;
  projectName: string;
  role: string;
  startDate: string;
  endDate: string;
  allocationPercent: number;
  allocationDays: number;
  allocationType: string;
  remark: string;
};

type ResourceAvailability = {
  id: string;
  personId: string;
  name: string;
  date: string;
  availablePercent: number;
  availabilityType: string;
  reason: string;
  remark: string;
};

type ResourceCalendarCell = {
  personId: string;
  date: string;
  availablePercent: number;
  allocatedPercent: number;
  allocatedDays: number;
  status: ResourceLoadStatus;
  projects: Array<{
    projectId: string;
    projectName: string;
    role: string;
    allocationPercent: number;
  }>;
};

type ResourceConflict = {
  type: 'overload' | 'multi_project' | 'unavailable';
  severity: 'high' | 'medium' | 'low';
  personId: string;
  name: string;
  date: string;
  message: string;
};

type ResourceCalendarResponse = {
  generatedAt: string;
  source: ResourceCalendarSource;
  error?: string;
  range: {
    startDate: string;
    endDate: string;
    days: string[];
  };
  summary: {
    peopleCount: number;
    availablePersonDays: number;
    allocatedPersonDays: number;
    utilizationRate: number;
    overloadedPeopleCount: number;
    conflictCount: number;
  };
  people: ResourcePerson[];
  allocations: ResourceAllocation[];
  availability: ResourceAvailability[];
  cells: ResourceCalendarCell[];
  conflicts: ResourceConflict[];
};

const CLUSTER_FIELD_MAP: Record<keyof Omit<ClusterRiskBoardItem, 'hasKeyDemo'> | 'keyDemo', string> = {
  recordId: 'record_id',
  index: '序号',
  projectName: '项目名称|重点项目|项目|名称',
  projectId: '项目ID（未立项不填）|项目ID|项目编号',
  ownerOne: '项目1号位|1号位|项目负责人',
  pm: 'PM|项目经理',
  ownerPm: '项目1号位和PM|PM|项目经理|负责人',
  riskLight: '风险情况',
  deliveryScope: '交付范围',
  keyDemo: '近期重点演示',
  weeklyProgress: '周进展（PM）',
  dailyRiskHelp: 'Daily风险求助（PM）',
  riskResolution: '风险解决情况',
  qualityGap: '质量状态与GAP-叶芳',
  qualityLevel: '质量等级'
};

const DELIVERY_ROADMAP_FIELD_MAP: Record<string, string> = {
  categoryL1: 'category_l1|一级分类',
  categoryL2: 'category_l2|二级分类',
  ySortOrder: 'y_sort_order|排序权重',
  targetDate: 'target_date|精确日期',
  targetQuarter: 'target_quarter|所属季度',
  isTbd: 'is_tbd|是否待定',
  milestoneName: 'milestone_name|里程碑名称',
  techDetail: 'tech_detail|技术细节',
  iconStyle: 'icon_style|图标样式',
  hasFlag: 'has_flag|是否关键',
  deliveryStatus: '交付状态|delivery_status',
  vehicleOwner: '车型负责人|负责人|vehicle_owner',
  riskLevel: '风险等级|risk_level',
  keyRisk: '关键风险|key_risk',
  latestProgress: '最新进展|latest_progress',
  nextAction: '下一步动作|next_action',
  dependencies: '依赖项|dependencies',
  updatedAt: '更新时间|updated_at'
};

const ROADMAP_ICON_META: Record<string, DeliveryRoadmapLegendItem> = {
  '1.0_main': { iconStyle: '1.0_main', label: '1.0 主线', color: '#8b5cf6' },
  '1.0+_main': { iconStyle: '1.0+_main', label: '1.0+ 主线', color: '#1d4ed8' },
  '2.0_main': { iconStyle: '2.0_main', label: '2.0 主线', color: '#22c7ee' },
  edge_ai: { iconStyle: 'edge_ai', label: '端侧智能', color: '#f97316' }
};

const RESOURCE_CALENDAR_FIELD_MAP: Record<string, string> = {
  personId: 'person_id|人员ID',
  name: 'name|姓名',
  department: 'department|部门',
  role: 'role|角色',
  level: 'level|职级',
  location: 'location|地点',
  dailyCapacity: 'daily_capacity|日标准产能',
  personStatus: 'status|状态',
  personRemark: 'remark|备注',
  allocationId: 'allocation_id|分配ID',
  projectId: 'project_id|项目ID',
  projectName: 'project_name|项目名称',
  startDate: 'start_date|开始日期',
  endDate: 'end_date|结束日期|结束时间',
  allocationPercent: 'allocation_percent|投入比例',
  allocationDays: 'allocation_days|投入人天',
  allocationType: 'allocation_type|分配类型',
  allocationRemark: 'remark|备注',
  availabilityId: 'availability_id|记录ID',
  date: 'date|日期',
  availablePercent: 'available_percent|可用比例',
  availabilityType: 'availability_type|不可用类型',
  reason: 'reason|原因',
  availabilityRemark: 'remark|备注'
};

@Injectable()
export class DashboardService {
  private readonly cacheTtl = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly feishuService: FeishuService
  ) {}

  async efficiency(projectId: number, actor?: AuthActor) {
    await this.accessService.assertProjectAccess(actor, projectId);

    const cacheKey = `dashboard:${projectId}:efficiency`;
    const cached = await this.redisService.get<ReturnType<typeof this.computeEfficiency>>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.computeEfficiency(projectId);
    await this.redisService.set(cacheKey, result, this.cacheTtl);
    return result;
  }

  private async computeEfficiency(projectId: number) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new Error('Project not found');
    }

    const [requirements, bugs, workItems, costEntries, worklogs, milestones] = await Promise.all([
      this.prisma.requirement.findMany({ where: { projectId } }),
      this.prisma.bug.findMany({ where: { projectId } }),
      this.prisma.workItem.findMany({ where: { projectId } }),
      this.prisma.costEntry.findMany({ where: { projectId } }),
      this.prisma.worklog.findMany({ where: { projectId } }),
      this.prisma.milestone.findMany({ where: { projectId } })
    ]);

    // Requirement metrics
    const requirementCount = requirements.length;
    const approvedCount = requirements.filter((r) => r.status === RequirementStatus.approved || r.status === RequirementStatus.planned || r.status === RequirementStatus.done).length;
    const doneReqCount = requirements.filter((r) => r.status === RequirementStatus.done).length;
    const approvedRate = requirementCount > 0 ? Math.round((approvedCount / requirementCount) * 100) : 0;
    const doneRate = requirementCount > 0 ? Math.round((doneReqCount / requirementCount) * 100) : 0;

    // Bug metrics
    const bugCount = bugs.length;
    const openBugCount = bugs.filter((b) => b.status === BugStatus.open || b.status === BugStatus.in_progress).length;
    const resolvedBugCount = bugs.filter((b) => b.status === BugStatus.resolved || b.status === BugStatus.closed).length;
    const resolvedBugs = bugs.filter((b) => b.status === BugStatus.resolved && b.resolvedAt);
    const avgResolutionDays =
      resolvedBugs.length > 0
        ? Number(
            (
              resolvedBugs.reduce((sum, b) => {
                const created = new Date(b.createdAt).getTime();
                const resolved = new Date(b.resolvedAt!).getTime();
                return sum + (resolved - created) / (1000 * 60 * 60 * 24);
              }, 0) / resolvedBugs.length
            ).toFixed(1)
          )
        : 0;

    // Work item metrics
    const workItemCount = workItems.length;
    const doneWorkItemCount = workItems.filter((w) => w.status === WorkItemStatus.done || w.status === WorkItemStatus.closed).length;
    const doneWorkItemRate = workItemCount > 0 ? Math.round((doneWorkItemCount / workItemCount) * 100) : 0;

    // Cost metrics
    const laborCost = worklogs.reduce((sum, w) => sum + w.hours * w.hourlyRate, 0);
    const outsourceCost = costEntries.filter((c) => c.type === 'outsource').reduce((sum, c) => sum + c.amount, 0);
    const cloudCost = costEntries.filter((c) => c.type === 'cloud').reduce((sum, c) => sum + c.amount, 0);
    const totalCost = laborCost + outsourceCost + cloudCost;

    // Milestone / schedule efficiency
    const onTimeMilestones = milestones.filter((m) => {
      if (!m.actualDate) return false;
      return m.actualDate <= m.plannedDate;
    });
    const onTimeDeliveryRate = milestones.length > 0 ? Math.round((onTimeMilestones.length / milestones.length) * 100) : 0;

    return {
      projectId,
      projectName: project.name,
      metrics: {
        requirementCount,
        approvedRate,
        doneRate,
        bugCount,
        openBugCount,
        resolvedBugCount,
        avgResolutionDays,
        sprintCount: 0,
        completedSprintCount: 0,
        workItemCount,
        doneWorkItemRate,
        totalCost,
        laborCost,
        outsourceCost,
        cloudCost,
        onTimeDeliveryRate
      }
    };
  }

  async overview(actor?: AuthActor) {
    const cacheKey = `dashboard:overview`;
    const cached = await this.redisService.get<ReturnType<typeof this.computeOverview>>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.computeOverview(actor);
    await this.redisService.set(cacheKey, result, this.cacheTtl);
    return result;
  }

  async clusterRiskBoard(actor?: AuthActor & { organizationId?: string }, force = false): Promise<ClusterRiskBoardResponse> {
    const cacheKey = this.clusterRiskBoardCacheKey(actor);
    if (!force) {
      const cached = await this.redisService.get<ClusterRiskBoardResponse>(cacheKey);
      if (cached) return cached;
    }

    const appToken = await this.getClusterConfig('CLUSTER_RISK_BOARD_APP_TOKEN', actor?.organizationId);
    const tableId = await this.getClusterConfig('CLUSTER_RISK_BOARD_TABLE_ID', actor?.organizationId);
    const viewId = await this.getClusterConfig('CLUSTER_RISK_BOARD_VIEW_ID', actor?.organizationId);
    const fieldMapRaw = await this.getClusterConfig('CLUSTER_RISK_BOARD_FIELD_MAP', actor?.organizationId);

    if (!appToken || !tableId) {
      return this.emptyClusterRiskBoard(
        'config_missing',
        '缺少 CLUSTER_RISK_BOARD_APP_TOKEN 或 CLUSTER_RISK_BOARD_TABLE_ID，请先在系统设置中配置大看板数据源。'
      );
    }

    try {
      const fieldMap = this.parseClusterFieldMap(fieldMapRaw);
      const data = await this.feishuService.listRecords({
        pageSize: 500,
        viewId: viewId || undefined,
        opts: { appToken, tableId }
      });
      const items = (data.items || [])
        .map((record) => this.normalizeClusterRecord(record as { record_id?: string; fields?: Record<string, unknown> }, fieldMap))
        .filter((item) => item.projectName || item.projectId || item.index);
      const visibleItems = await this.filterClusterRiskItemsForActor(items, actor);
      visibleItems
        .sort((a, b) => this.riskSortWeight(a.riskLight) - this.riskSortWeight(b.riskLight));
      const response = this.buildClusterRiskBoardResponse('feishu', visibleItems);
      await this.redisService.set(cacheKey, response, this.cacheTtl);
      return response;
    } catch (err: any) {
      return this.emptyClusterRiskBoard('error', err?.message || '集群风险状态大看板数据加载失败。');
    }
  }

  async updateClusterRiskBoardItem(
    recordId: string,
    body: Record<string, unknown>,
    actor?: AuthActor & { organizationId?: string }
  ) {
    if (!['super_admin', 'project_manager', 'pm'].includes(actor?.role ?? '')) {
      throw new ForbiddenException('无权维护集群风险状态');
    }
    if (!recordId.trim()) throw new BadRequestException('缺少飞书记录ID');

    const appToken = await this.getClusterConfig('CLUSTER_RISK_BOARD_APP_TOKEN', actor?.organizationId);
    const tableId = await this.getClusterConfig('CLUSTER_RISK_BOARD_TABLE_ID', actor?.organizationId);
    const fieldMapRaw = await this.getClusterConfig('CLUSTER_RISK_BOARD_FIELD_MAP', actor?.organizationId);
    if (!appToken || !tableId) {
      throw new BadRequestException('缺少 CLUSTER_RISK_BOARD_APP_TOKEN 或 CLUSTER_RISK_BOARD_TABLE_ID');
    }

    const fieldMap = this.parseClusterFieldMap(fieldMapRaw);
    const current = await this.feishuService.getRecord(recordId, { appToken, tableId });
    const currentItem = this.normalizeClusterRecord({ record_id: recordId, fields: current?.fields || {} }, fieldMap);
    await this.assertCanUpdateClusterProject(currentItem, actor);

    const tableFields = await this.feishuService.getTableFieldNames(appToken, tableId);
    const fields = this.buildClusterUpdateFields(body, fieldMap, tableFields, actor?.role);
    if (Object.keys(fields).length === 0) {
      throw new BadRequestException('没有可更新的字段');
    }
    await this.feishuService.updateRawRecord(recordId, fields, { appToken, tableId });
    await this.clearClusterRiskBoardCache(actor);
    return { ok: true };
  }

  async createClusterRiskBoardItem(
    body: Record<string, unknown>,
    actor?: AuthActor & { organizationId?: string }
  ) {
    if (!['super_admin', 'project_manager'].includes(actor?.role ?? '')) {
      throw new ForbiddenException('无权新增集群风险项目');
    }

    const appToken = await this.getClusterConfig('CLUSTER_RISK_BOARD_APP_TOKEN', actor?.organizationId);
    const tableId = await this.getClusterConfig('CLUSTER_RISK_BOARD_TABLE_ID', actor?.organizationId);
    const fieldMapRaw = await this.getClusterConfig('CLUSTER_RISK_BOARD_FIELD_MAP', actor?.organizationId);
    if (!appToken || !tableId) {
      throw new BadRequestException('缺少 CLUSTER_RISK_BOARD_APP_TOKEN 或 CLUSTER_RISK_BOARD_TABLE_ID');
    }

    const fieldMap = this.parseClusterFieldMap(fieldMapRaw);
    const [nextIndex, tableFields] = await Promise.all([
      this.nextClusterIndex(appToken, tableId, fieldMap),
      this.feishuService.getTableFieldNames(appToken, tableId)
    ]);
    const fields = this.buildClusterCreateFields(body, fieldMap, nextIndex, tableFields);
    const result = await this.feishuService.createRawRecord(fields, { appToken, tableId }) as Record<string, unknown>;
    await this.clearClusterRiskBoardCache(actor);
    return { ok: true, recordId: result?.record_id };
  }

  async deliveryRoadmap(actor?: AuthActor & { organizationId?: string }, force = false): Promise<DeliveryRoadmapResponse> {
    const cacheKey = `dashboard:delivery-roadmap:${actor?.organizationId ?? 'global'}`;
    if (!force) {
      const cached = await this.redisService.get<DeliveryRoadmapResponse>(cacheKey);
      if (cached) return cached;
    }

    const appToken = await this.getClusterConfig('DELIVERY_ROADMAP_APP_TOKEN', actor?.organizationId);
    const tableId = await this.getClusterConfig('DELIVERY_ROADMAP_TABLE_ID', actor?.organizationId);
    const viewId = await this.getClusterConfig('DELIVERY_ROADMAP_VIEW_ID', actor?.organizationId);
    const fieldMapRaw = await this.getClusterConfig('DELIVERY_ROADMAP_FIELD_MAP', actor?.organizationId);

    if (!appToken || !tableId) {
      return this.emptyDeliveryRoadmap(
        'config_missing',
        '缺少 DELIVERY_ROADMAP_APP_TOKEN 或 DELIVERY_ROADMAP_TABLE_ID，请先在系统设置中配置公司交付车型大图数据源。'
      );
    }

    try {
      const fieldMap = this.parseDeliveryRoadmapFieldMap(fieldMapRaw);
      const data = await this.feishuService.listRecords({
        pageSize: 500,
        viewId: viewId || undefined,
        opts: { appToken, tableId }
      });
      const rawItems = (data.items || [])
        .flatMap((record, index) => {
          const row = record as { record_id?: string; recordId?: string; id?: string; fields?: Record<string, unknown> };
          const fields = row.fields || {};
          if (!this.hasDeliveryRoadmapRow(fields, fieldMap)) return [];
          return [this.normalizeDeliveryRoadmapRecord(fields, fieldMap, row.record_id || row.recordId || row.id || `row-${index + 1}`)];
        });
      const response = this.buildDeliveryRoadmapResponse('feishu', rawItems);
      await this.redisService.set(cacheKey, response, this.cacheTtl);
      return response;
    } catch (err: any) {
      return this.emptyDeliveryRoadmap('error', err?.message || '公司交付车型大图数据加载失败。');
    }
  }

  async resourceCalendar(actor?: AuthActor & { organizationId?: string }, force = false): Promise<ResourceCalendarResponse> {
    const cacheKey = `dashboard:resource-calendar:v2:${actor?.organizationId ?? 'global'}`;
    if (!force) {
      const cached = await this.redisService.get<ResourceCalendarResponse>(cacheKey);
      if (cached) return cached;
    }

    const peopleAppToken = await this.getClusterConfig('RESOURCE_CALENDAR_PEOPLE_APP_TOKEN', actor?.organizationId);
    const peopleTableId = await this.getClusterConfig('RESOURCE_CALENDAR_PEOPLE_TABLE_ID', actor?.organizationId);
    const peopleViewId = await this.getClusterConfig('RESOURCE_CALENDAR_PEOPLE_VIEW_ID', actor?.organizationId);
    const allocationsAppToken = await this.getClusterConfig('RESOURCE_CALENDAR_ALLOCATIONS_APP_TOKEN', actor?.organizationId);
    const allocationsTableId = await this.getClusterConfig('RESOURCE_CALENDAR_ALLOCATIONS_TABLE_ID', actor?.organizationId);
    const allocationsViewId = await this.getClusterConfig('RESOURCE_CALENDAR_ALLOCATIONS_VIEW_ID', actor?.organizationId);
    const availabilityAppToken = await this.getClusterConfig('RESOURCE_CALENDAR_AVAILABILITY_APP_TOKEN', actor?.organizationId);
    const availabilityTableId = await this.getClusterConfig('RESOURCE_CALENDAR_AVAILABILITY_TABLE_ID', actor?.organizationId);
    const availabilityViewId = await this.getClusterConfig('RESOURCE_CALENDAR_AVAILABILITY_VIEW_ID', actor?.organizationId);
    const fieldMapRaw = await this.getClusterConfig('RESOURCE_CALENDAR_FIELD_MAP', actor?.organizationId);

    if (!peopleAppToken || !peopleTableId || !allocationsAppToken || !allocationsTableId) {
      return this.emptyResourceCalendar(
        'config_missing',
        '缺少 RESOURCE_CALENDAR_PEOPLE_* 或 RESOURCE_CALENDAR_ALLOCATIONS_* 配置，请先在系统设置中配置项目资源日历飞书数据源。'
      );
    }

    try {
      const fieldMap = this.parseResourceCalendarFieldMap(fieldMapRaw);
      const [peopleData, allocationsData, availabilityData] = await Promise.all([
        this.feishuService.listRecords({
          pageSize: 500,
          viewId: peopleViewId || undefined,
          opts: { appToken: peopleAppToken, tableId: peopleTableId }
        }),
        this.feishuService.listRecords({
          pageSize: 500,
          viewId: allocationsViewId || undefined,
          opts: { appToken: allocationsAppToken, tableId: allocationsTableId }
        }),
        availabilityAppToken && availabilityTableId
          ? this.feishuService.listRecords({
              pageSize: 500,
              viewId: availabilityViewId || undefined,
              opts: { appToken: availabilityAppToken, tableId: availabilityTableId }
            })
          : Promise.resolve({ items: [] })
      ]);

      const feishuPeople = (peopleData.items || []).flatMap((record, index) => {
        const row = record as { record_id?: string; recordId?: string; id?: string; fields?: Record<string, unknown> };
        const person = this.normalizeResourcePerson(row.fields || {}, fieldMap, row.record_id || row.recordId || row.id || `person-${index + 1}`);
        return person.name || person.personId ? [person] : [];
      });
      const allocations = (allocationsData.items || []).flatMap((record, index) => {
        const row = record as { record_id?: string; recordId?: string; id?: string; fields?: Record<string, unknown> };
        const allocation = this.normalizeResourceAllocation(row.fields || {}, fieldMap, row.record_id || row.recordId || row.id || `allocation-${index + 1}`);
        return (allocation.personId || allocation.name) && allocation.startDate && allocation.endDate ? [allocation] : [];
      });
      const availability = (availabilityData.items || []).flatMap((record, index) => {
        const row = record as { record_id?: string; recordId?: string; id?: string; fields?: Record<string, unknown> };
        const item = this.normalizeResourceAvailability(row.fields || {}, fieldMap, row.record_id || row.recordId || row.id || `availability-${index + 1}`);
        return (item.personId || item.name) && item.date ? [item] : [];
      });

      const people = await this.applySystemDepartmentsToResourcePeople(feishuPeople, actor?.organizationId);
      const response = this.buildResourceCalendarResponse(people, allocations, availability);
      await this.redisService.set(cacheKey, response, this.cacheTtl);
      return response;
    } catch (err: any) {
      return this.emptyResourceCalendar('error', err?.message || '项目资源日历大看板数据加载失败。');
    }
  }

  private async computeOverview(actor?: AuthActor) {
    const accessibleProjectIds = await this.accessService.getAccessibleProjectIds(actor);
    const projectFilter = accessibleProjectIds === null
      ? undefined
      : { id: { in: accessibleProjectIds } };

    const projects = await this.prisma.project.findMany({
      where: projectFilter,
      orderBy: { id: 'asc' }
    });
    const ids = projects.map((item) => item.id);
    if (ids.length === 0) {
      return {
        summary: {
          projectCount: 0,
          requirementCount: 0,
          riskProjectCount: 0
        },
        projects: []
      };
    }

    const [requirements, costs, tasks, worklogs] = await Promise.all([
      this.prisma.requirement.findMany({ where: { projectId: { in: ids } }, orderBy: { id: 'asc' } }),
      this.prisma.costEntry.findMany({ where: { projectId: { in: ids } } }),
      this.prisma.task.findMany({ where: { projectId: { in: ids } } }),
      this.prisma.worklog.findMany({ where: { projectId: { in: ids } } })
    ]);

    const projectCards = projects.map((project) => {
      const projectRequirements = requirements.filter((item) => item.projectId === project.id);
      const projectCosts = costs.filter((item) => item.projectId === project.id);
      const projectWorklogs = worklogs.filter((item) => item.projectId === project.id);
      const blockedTasks = tasks.filter((item) => item.projectId === project.id && item.status === TaskStatus.blocked).length;
      const worklogLaborCost = projectWorklogs.reduce((sum, item) => sum + item.hours * item.hourlyRate, 0);
      const actualCost = projectCosts.reduce((sum, item) => sum + item.amount, 0) + worklogLaborCost;
      const varianceRate = project.budget === 0 ? 0 : +(((actualCost - project.budget) / project.budget) * 100).toFixed(2);
      const requirementRisk = projectRequirements.filter((item) => item.changeCount >= 2).length;
      const healthScore = Math.round(Math.max(0, 100 - Math.abs(varianceRate) - blockedTasks * 12 - requirementRisk * 8) * 100) / 100;

      return {
        projectId: project.id,
        projectName: project.name,
        requirementCount: projectRequirements.length,
        blockedTasks,
        actualCost,
        budget: project.budget,
        varianceRate,
        healthScore
      };
    });

    return {
      summary: {
        projectCount: projects.length,
        requirementCount: requirements.length,
        riskProjectCount: projectCards.filter((item) => item.healthScore < 70).length
      },
      projects: projectCards
    };
  }

  private async getClusterConfig(key: string, organizationId?: string): Promise<string> {
    return (await this.configService.get(key, organizationId))?.trim() || '';
  }

  private emptyClusterRiskBoard(source: 'config_missing' | 'error', error: string): ClusterRiskBoardResponse {
    return {
      generatedAt: new Date().toISOString(),
      source,
      error,
      summary: {
        totalProjects: 0,
        redCount: 0,
        yellowCount: 0,
        greenCount: 0,
        emptyRiskCount: 0,
        keyDemoCount: 0,
        dailyRiskHelpCount: 0,
        highQualityRiskCount: 0
      },
      items: []
    };
  }

  private buildClusterRiskBoardResponse(source: 'feishu', items: ClusterRiskBoardItem[]): ClusterRiskBoardResponse {
    return {
      generatedAt: new Date().toISOString(),
      source,
      summary: {
        totalProjects: items.length,
        redCount: items.filter((item) => item.riskLight === '红灯').length,
        yellowCount: items.filter((item) => item.riskLight === '黄灯').length,
        greenCount: items.filter((item) => item.riskLight === '绿灯').length,
        emptyRiskCount: items.filter((item) => item.riskLight === '未填').length,
        keyDemoCount: items.filter((item) => item.hasKeyDemo === true).length,
        dailyRiskHelpCount: items.filter((item) => Boolean(item.dailyRiskHelp.trim())).length,
        highQualityRiskCount: items.filter((item) => item.qualityLevel.includes('高') || item.qualityGap.includes('高风险')).length
      },
      items
    };
  }

  private emptyDeliveryRoadmap(source: Exclude<DeliveryRoadmapSource, 'feishu'>, error: string): DeliveryRoadmapResponse {
    return {
      generatedAt: new Date().toISOString(),
      source,
      error,
      timeAxis: {
        years: [],
        quarters: [],
        startDate: '',
        endDate: ''
      },
      lanes: [],
      items: [],
      legend: []
    };
  }

  private emptyResourceCalendar(source: Exclude<ResourceCalendarSource, 'feishu'>, error: string): ResourceCalendarResponse {
    const days = this.buildResourceCalendarDays(56);
    return {
      generatedAt: new Date().toISOString(),
      source,
      error,
      range: {
        startDate: days[0] || '',
        endDate: days[days.length - 1] || '',
        days
      },
      summary: {
        peopleCount: 0,
        availablePersonDays: 0,
        allocatedPersonDays: 0,
        utilizationRate: 0,
        overloadedPeopleCount: 0,
        conflictCount: 0
      },
      people: [],
      allocations: [],
      availability: [],
      cells: [],
      conflicts: []
    };
  }

  private buildResourceCalendarResponse(peopleInput: ResourcePerson[], allocations: ResourceAllocation[], availability: ResourceAvailability[]): ResourceCalendarResponse {
    const days = this.buildResourceCalendarDays(56);
    const people = this.mergeResourcePeople(peopleInput, allocations).sort(
      (a, b) => a.department.localeCompare(b.department) || a.role.localeCompare(b.role) || a.name.localeCompare(b.name)
    );
    const availabilityMap = new Map(availability.map((item) => [`${this.resourcePersonKey(item)}::${item.date}`, item]));
    const cells: ResourceCalendarCell[] = [];
    const conflicts: ResourceConflict[] = [];
    let availablePersonDays = 0;
    let allocatedPersonDays = 0;

    for (const person of people) {
      const personKey = this.resourcePersonKey(person);
      for (const date of days) {
        const dayAvailability = availabilityMap.get(`${personKey}::${date}`);
        const availablePercent = dayAvailability ? dayAvailability.availablePercent : 100;
        const dayAllocations = allocations.filter((item) => this.resourcePersonKey(item) === personKey && this.isDateInRange(date, item.startDate, item.endDate));
        const allocatedPercent = Math.round(dayAllocations.reduce((sum, item) => sum + this.effectiveAllocationPercent(item, person), 0) * 100) / 100;
        const allocatedDays = Math.round((person.dailyCapacity * allocatedPercent / 100) * 100) / 100;
        availablePersonDays += person.dailyCapacity * availablePercent / 100;
        allocatedPersonDays += allocatedDays;

        const projects = dayAllocations.map((item) => ({
          projectId: item.projectId,
          projectName: item.projectName,
          role: item.role,
          allocationPercent: this.effectiveAllocationPercent(item, person)
        }));
        const status = this.resourceLoadStatus(allocatedPercent, availablePercent);
        cells.push({
          personId: person.personId || person.name,
          date,
          availablePercent,
          allocatedPercent,
          allocatedDays,
          status,
          projects
        });

        if (status === 'overloaded') {
          conflicts.push({
            type: 'overload',
            severity: 'high',
            personId: person.personId || person.name,
            name: person.name,
            date,
            message: `${person.name} ${date} 投入 ${allocatedPercent}%，超过可用 ${availablePercent}%`
          });
        }
        if (availablePercent <= 0 && allocatedPercent > 0) {
          conflicts.push({
            type: 'unavailable',
            severity: 'high',
            personId: person.personId || person.name,
            name: person.name,
            date,
            message: `${person.name} ${date} 不可用但仍有项目分配`
          });
        }
      }
    }

    const overloadedPeopleCount = new Set(cells.filter((cell) => cell.status === 'overloaded').map((cell) => cell.personId)).size;
    const roundedAvailable = Math.round(availablePersonDays * 100) / 100;
    const roundedAllocated = Math.round(allocatedPersonDays * 100) / 100;
    return {
      generatedAt: new Date().toISOString(),
      source: 'feishu',
      range: {
        startDate: days[0] || '',
        endDate: days[days.length - 1] || '',
        days
      },
      summary: {
        peopleCount: people.length,
        availablePersonDays: roundedAvailable,
        allocatedPersonDays: roundedAllocated,
        utilizationRate: roundedAvailable > 0 ? Math.round((roundedAllocated / roundedAvailable) * 10000) / 100 : 0,
        overloadedPeopleCount,
        conflictCount: conflicts.length
      },
      people,
      allocations,
      availability,
      cells,
      conflicts: conflicts.slice(0, 100)
    };
  }

  private buildDeliveryRoadmapResponse(source: 'feishu', rawItems: Omit<DeliveryRoadmapItem, 'xPercent'>[]): DeliveryRoadmapResponse {
    const timeAxis = this.buildRoadmapTimeAxis(rawItems);
    const items = rawItems
      .map((item) => ({
        ...item,
        xPercent: this.computeRoadmapXPercent(item, timeAxis.startDate, timeAxis.endDate)
      }))
      .sort((a, b) => a.ySortOrder - b.ySortOrder || a.categoryL1.localeCompare(b.categoryL1) || a.categoryL2.localeCompare(b.categoryL2));

    const laneMap = new Map<string, DeliveryRoadmapLane>();
    for (const item of items) {
      const lane = laneMap.get(item.laneId) || {
        id: item.laneId,
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        ySortOrder: item.ySortOrder,
        items: []
      };
      lane.items.push(item);
      laneMap.set(item.laneId, lane);
    }
    const lanes = Array.from(laneMap.values()).sort((a, b) => a.ySortOrder - b.ySortOrder || a.categoryL1.localeCompare(b.categoryL1) || a.categoryL2.localeCompare(b.categoryL2));
    const legend = Array.from(new Set(items.filter((item) => item.milestoneName || item.targetDate || item.targetQuarter).map((item) => item.iconStyle || 'unknown')))
      .map((iconStyle) => ROADMAP_ICON_META[iconStyle] || { iconStyle, label: iconStyle === 'unknown' ? '未分类' : iconStyle, color: '#64748b' });

    return {
      generatedAt: new Date().toISOString(),
      source,
      timeAxis,
      lanes,
      items,
      legend
    };
  }

  private normalizeClusterRecord(record: { record_id?: string; fields?: Record<string, unknown> }, fieldMap: Record<string, string>): ClusterRiskBoardItem {
    const fields = record.fields || {};
    const get = (key: keyof Omit<ClusterRiskBoardItem, 'hasKeyDemo'> | 'keyDemo') => this.fieldValue(fields, fieldMap[key] || CLUSTER_FIELD_MAP[key]);
    const qualityLevel = get('qualityLevel') || this.findBlankHeaderValue(fields) || this.inferQualityLevel(get('qualityGap'));
    const ownerOne = get('ownerOne');
    const pm = get('pm');
    const legacyOwnerPm = get('ownerPm');
    return {
      recordId: record.record_id || '',
      index: get('index'),
      projectName: get('projectName'),
      projectId: get('projectId'),
      ownerOne,
      pm,
      ownerPm: legacyOwnerPm || [ownerOne, pm].filter(Boolean).join(' / '),
      riskLight: this.normalizeRiskLight(get('riskLight')),
      deliveryScope: get('deliveryScope'),
      hasKeyDemo: this.normalizeYesNo(get('keyDemo')),
      weeklyProgress: get('weeklyProgress'),
      dailyRiskHelp: get('dailyRiskHelp'),
      riskResolution: get('riskResolution'),
      qualityGap: get('qualityGap'),
      qualityLevel
    };
  }

  private buildClusterUpdateFields(body: Record<string, unknown>, fieldMap: Record<string, string>, tableFields?: Set<string>, actorRole?: string) {
    const allowed: Array<[string, keyof Omit<ClusterRiskBoardItem, 'hasKeyDemo'>]> = [
      ['projectId', 'projectId'],
      ['ownerOne', 'ownerOne'],
      ['riskLight', 'riskLight'],
      ['weeklyProgress', 'weeklyProgress'],
      ['dailyRiskHelp', 'dailyRiskHelp'],
      ['riskResolution', 'riskResolution'],
      ['deliveryScope', 'deliveryScope'],
      ['qualityGap', 'qualityGap'],
      ['qualityLevel', 'qualityLevel']
    ];
    if (actorRole !== 'pm') {
      allowed.unshift(['pm', 'pm']);
      allowed.unshift(['projectName', 'projectName']);
    }
    const fields: Record<string, unknown> = {};
    for (const [bodyKey, fieldKey] of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, bodyKey)) {
        const configuredField = fieldMap[fieldKey] || CLUSTER_FIELD_MAP[fieldKey];
        const targetField = tableFields ? this.pickWritableClusterField(tableFields, configuredField) : configuredField;
        if (targetField) fields[targetField] = String(body[bodyKey] ?? '').trim();
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'hasKeyDemo')) {
      const value = body.hasKeyDemo;
      const configuredField = fieldMap.keyDemo || CLUSTER_FIELD_MAP.keyDemo;
      const targetField = tableFields ? this.pickWritableClusterField(tableFields, configuredField) : configuredField;
      if (targetField) fields[targetField] = value === null ? '' : value ? '是' : '否';
    }
    return fields;
  }

  private buildClusterCreateFields(body: Record<string, unknown>, fieldMap: Record<string, string>, nextIndex: string, tableFields: Set<string>) {
    const projectName = String(body.projectName ?? '').trim();
    const pm = String(body.pm ?? body.ownerPm ?? '').trim();
    if (!projectName) throw new BadRequestException('项目名称不能为空');
    if (!pm) throw new BadRequestException('PM不能为空');

    const fields = this.buildClusterUpdateFields(body, fieldMap, tableFields);
    const projectNameField = this.pickWritableClusterField(tableFields, fieldMap.projectName || CLUSTER_FIELD_MAP.projectName, ['项目名称', '重点项目', '项目', '名称']);
    if (!projectNameField) {
      throw new BadRequestException('集群风险表缺少可写的项目名称字段，请在 CLUSTER_RISK_BOARD_FIELD_MAP 中配置 projectName 对应字段。');
    }
    const indexField = this.pickWritableClusterField(tableFields, fieldMap.index || CLUSTER_FIELD_MAP.index, ['序号', '编号', '排序']);
    const baseFields: Record<string, unknown> = {
      [projectNameField]: projectName
    };
    if (indexField) baseFields[indexField] = nextIndex;
    const optionalFields: Array<[string, keyof Omit<ClusterRiskBoardItem, 'hasKeyDemo'>]> = [
      ['projectId', 'projectId'],
      ['ownerOne', 'ownerOne'],
      ['pm', 'pm']
    ];
    for (const [bodyKey, fieldKey] of optionalFields) {
      const value = String(body[bodyKey] ?? '').trim();
      const targetField = this.pickWritableClusterField(tableFields, fieldMap[fieldKey] || CLUSTER_FIELD_MAP[fieldKey]);
      if (value && targetField) baseFields[targetField] = value;
    }
    const riskLightField = this.pickWritableClusterField(tableFields, fieldMap.riskLight || CLUSTER_FIELD_MAP.riskLight);
    if (riskLightField && !fields[riskLightField]) {
      fields[riskLightField] = '未填';
    }
    return { ...baseFields, ...fields };
  }

  private pickWritableClusterField(tableFields: Set<string>, preferred: string, fallbacks: string[] = []) {
    const candidates = [
      ...String(preferred || '').split(/[|,，]/),
      ...fallbacks
    ].map((item) => item.trim()).filter(Boolean);
    const fields = Array.from(tableFields.values());
    for (const candidate of candidates) {
      const exact = fields.find((field) => field === candidate);
      if (exact) return exact;
      const normalizedCandidate = this.normalizeFieldHeader(candidate);
      const normalized = fields.find((field) => this.normalizeFieldHeader(field) === normalizedCandidate);
      if (normalized) return normalized;
    }
    return '';
  }

  private async nextClusterIndex(appToken: string, tableId: string, fieldMap: Record<string, string>) {
    const data = await this.feishuService.listRecords({
      pageSize: 500,
      opts: { appToken, tableId }
    });
    const indexField = fieldMap.index || CLUSTER_FIELD_MAP.index;
    const maxIndex = (data.items || []).reduce((max, record: any) => {
      const raw = this.fieldValue(record?.fields || {}, indexField);
      const match = raw.match(/\d+/);
      if (!match) return max;
      const value = Number(match[0]);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    return String(maxIndex + 1);
  }

  private async assertCanUpdateClusterProject(item: ClusterRiskBoardItem, actor?: AuthActor & { organizationId?: string }) {
    if (await this.canAccessClusterProject(item, actor)) return;
    throw new ForbiddenException('只能维护自己负责的项目状态');
  }

  private async filterClusterRiskItemsForActor(items: ClusterRiskBoardItem[], actor?: AuthActor & { organizationId?: string }) {
    if (actor?.role === 'super_admin' || actor?.role === 'project_manager') return items;
    const visible: ClusterRiskBoardItem[] = [];
    for (const item of items) {
      if (await this.canAccessClusterProject(item, actor)) visible.push(item);
    }
    return visible;
  }

  private async canAccessClusterProject(item: ClusterRiskBoardItem, actor?: AuthActor & { organizationId?: string }) {
    if (actor?.role === 'super_admin' || actor?.role === 'project_manager') return true;
    const accessibleProjectIds = await this.accessService.getAccessibleProjectIds(actor);
    if (accessibleProjectIds === null) return true;
    const numericProjectId = Number(item.projectId);
    if (Number.isInteger(numericProjectId) && accessibleProjectIds.includes(numericProjectId)) return true;
    const projectName = item.projectName.trim();
    if (projectName) {
      const project = await this.prisma.project.findFirst({
        where: {
          organizationId: actor?.organizationId || undefined,
          OR: [
            { name: projectName },
            { alias: projectName }
          ]
        },
        select: { id: true }
      });
      if (project && accessibleProjectIds.includes(project.id)) return true;
    }
    return this.isDelegatedClusterPm(item.pm || item.ownerPm, actor);
  }

  private clusterRiskBoardCacheKey(actor?: AuthActor & { organizationId?: string }) {
    const orgId = actor?.organizationId ?? 'global';
    if (actor?.role === 'super_admin' || actor?.role === 'project_manager') {
      return `dashboard:cluster-risk-board:${orgId}:all`;
    }
    return `dashboard:cluster-risk-board:${orgId}:user:${actor?.sub ?? 'anonymous'}:${actor?.role ?? 'unknown'}`;
  }

  private async clearClusterRiskBoardCache(actor?: AuthActor & { organizationId?: string }) {
    await this.redisService.delPattern(`dashboard:cluster-risk-board:${actor?.organizationId ?? 'global'}:*`);
  }

  private async isDelegatedClusterPm(ownerPm: string, actor?: AuthActor) {
    const delegatedNames = this.splitClusterPmNames(ownerPm);
    if (!delegatedNames.size) return false;

    const actorNames = new Set<string>();
    if (actor?.name?.trim()) actorNames.add(this.normalizeClusterPmName(actor.name));
    if (actor?.sub) {
      const user = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        select: { name: true, username: true }
      });
      if (user?.name) actorNames.add(this.normalizeClusterPmName(user.name));
      if (user?.username) actorNames.add(this.normalizeClusterPmName(user.username));
    }
    return Array.from(actorNames).some((name) => Boolean(name) && delegatedNames.has(name));
  }

  private splitClusterPmNames(value: string) {
    return new Set(
      String(value || '')
        .split(/[\s,，、/／;；|｜&+()（）【】\[\]<>《》]+/)
        .map((item) => this.normalizeClusterPmName(item))
        .filter(Boolean)
    );
  }

  private normalizeClusterPmName(value: string) {
    return String(value || '').trim().toLowerCase();
  }

  private parseClusterFieldMap(raw?: string | null): Record<string, string> {
    if (!raw?.trim()) return { ...CLUSTER_FIELD_MAP };
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...CLUSTER_FIELD_MAP };
      return {
        ...CLUSTER_FIELD_MAP,
        ...Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .map(([key, value]) => [key.trim(), String(value ?? '').trim()])
            .filter(([key, value]) => key && value)
        )
      };
    } catch {
      return { ...CLUSTER_FIELD_MAP };
    }
  }

  private parseDeliveryRoadmapFieldMap(raw?: string | null): Record<string, string> {
    if (!raw?.trim()) return { ...DELIVERY_ROADMAP_FIELD_MAP };
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DELIVERY_ROADMAP_FIELD_MAP };
      return {
        ...DELIVERY_ROADMAP_FIELD_MAP,
        ...Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .map(([key, value]) => [key.trim(), String(value ?? '').trim()])
            .filter(([key, value]) => key && value)
        )
      };
    } catch {
      return { ...DELIVERY_ROADMAP_FIELD_MAP };
    }
  }

  private parseResourceCalendarFieldMap(raw?: string | null): Record<string, string> {
    if (!raw?.trim()) return { ...RESOURCE_CALENDAR_FIELD_MAP };
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...RESOURCE_CALENDAR_FIELD_MAP };
      return {
        ...RESOURCE_CALENDAR_FIELD_MAP,
        ...Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .map(([key, value]) => [key.trim(), String(value ?? '').trim()])
            .filter(([key, value]) => key && value)
        )
      };
    } catch {
      return { ...RESOURCE_CALENDAR_FIELD_MAP };
    }
  }

  private normalizeDeliveryRoadmapRecord(fields: Record<string, unknown>, fieldMap: Record<string, string>, recordId: string): Omit<DeliveryRoadmapItem, 'xPercent'> {
    const get = (key: keyof typeof DELIVERY_ROADMAP_FIELD_MAP) => this.fieldValue(fields, fieldMap[key] || DELIVERY_ROADMAP_FIELD_MAP[key]);
    const targetDate = this.normalizeDateText(get('targetDate'));
    const targetQuarter = this.normalizeQuarterText(get('targetQuarter')) || this.quarterKeyFromDate(targetDate);
    const categoryL1 = get('categoryL1') || '未分组';
    const categoryL2 = get('categoryL2') || categoryL1;
    const ySortOrder = Number(get('ySortOrder'));
    return {
      id: recordId,
      categoryL1,
      categoryL2,
      ySortOrder: Number.isFinite(ySortOrder) ? ySortOrder : 9999,
      targetDate,
      targetQuarter,
      isTbd: this.normalizeBoolean(get('isTbd')),
      milestoneName: get('milestoneName'),
      techDetail: get('techDetail'),
      iconStyle: get('iconStyle') || 'unknown',
      hasFlag: this.normalizeBoolean(get('hasFlag')),
      deliveryStatus: get('deliveryStatus'),
      vehicleOwner: get('vehicleOwner'),
      riskLevel: get('riskLevel'),
      keyRisk: get('keyRisk'),
      latestProgress: get('latestProgress'),
      nextAction: get('nextAction'),
      dependencies: get('dependencies'),
      updatedAt: this.normalizeDateText(get('updatedAt')) || get('updatedAt'),
      laneId: `${categoryL1}::${categoryL2}`
    };
  }

  private hasDeliveryRoadmapRow(fields: Record<string, unknown>, fieldMap: Record<string, string>): boolean {
    const keys: Array<keyof typeof DELIVERY_ROADMAP_FIELD_MAP> = ['categoryL1', 'categoryL2', 'ySortOrder', 'targetDate', 'targetQuarter', 'milestoneName'];
    return keys.some((key) => Boolean(this.fieldValue(fields, fieldMap[key] || DELIVERY_ROADMAP_FIELD_MAP[key]).trim()));
  }

  private normalizeResourcePerson(fields: Record<string, unknown>, fieldMap: Record<string, string>, recordId: string): ResourcePerson {
    const get = (key: keyof typeof RESOURCE_CALENDAR_FIELD_MAP) => this.fieldValue(fields, fieldMap[key] || RESOURCE_CALENDAR_FIELD_MAP[key]);
    const personId = get('personId') || recordId;
    return {
      id: recordId,
      personId,
      name: get('name') || personId,
      department: get('department') || '未分组',
      role: get('role') || '未配置角色',
      level: get('level'),
      location: get('location'),
      dailyCapacity: this.normalizePositiveNumber(get('dailyCapacity'), 1),
      status: get('personStatus') || '在职',
      remark: get('personRemark')
    };
  }

  private normalizeResourceAllocation(fields: Record<string, unknown>, fieldMap: Record<string, string>, recordId: string): ResourceAllocation {
    const get = (key: keyof typeof RESOURCE_CALENDAR_FIELD_MAP) => this.fieldValue(fields, fieldMap[key] || RESOURCE_CALENDAR_FIELD_MAP[key]);
    const percent = this.normalizePercent(get('allocationPercent'), 100);
    return {
      id: get('allocationId') || recordId,
      personId: get('personId'),
      name: get('name'),
      projectId: get('projectId'),
      projectName: get('projectName') || '未命名项目',
      role: get('role'),
      startDate: this.normalizeDateText(get('startDate')),
      endDate: this.normalizeDateText(get('endDate')) || this.normalizeDateText(get('startDate')),
      allocationPercent: percent,
      allocationDays: this.normalizePositiveNumber(get('allocationDays'), 0),
      allocationType: get('allocationType'),
      remark: get('allocationRemark')
    };
  }

  private normalizeResourceAvailability(fields: Record<string, unknown>, fieldMap: Record<string, string>, recordId: string): ResourceAvailability {
    const get = (key: keyof typeof RESOURCE_CALENDAR_FIELD_MAP) => this.fieldValue(fields, fieldMap[key] || RESOURCE_CALENDAR_FIELD_MAP[key]);
    return {
      id: get('availabilityId') || recordId,
      personId: get('personId'),
      name: get('name'),
      date: this.normalizeDateText(get('date')),
      availablePercent: this.normalizePercent(get('availablePercent'), 0),
      availabilityType: get('availabilityType'),
      reason: get('reason'),
      remark: get('availabilityRemark')
    };
  }

  private mergeResourcePeople(people: ResourcePerson[], allocations: ResourceAllocation[]): ResourcePerson[] {
    const map = new Map<string, ResourcePerson>();
    for (const person of people) {
      map.set(this.resourcePersonKey(person), person);
    }
    for (const allocation of allocations) {
      const key = this.resourcePersonKey(allocation);
      if (!key || map.has(key)) continue;
      map.set(key, {
        id: key,
        personId: allocation.personId || allocation.name,
        name: allocation.name || allocation.personId,
        department: '未分组',
        role: allocation.role || '未配置角色',
        level: '',
        location: '',
        dailyCapacity: 1,
        status: '从分配表推断',
        remark: ''
      });
    }
    return Array.from(map.values());
  }

  private async applySystemDepartmentsToResourcePeople(people: ResourcePerson[], organizationId?: string | null): Promise<ResourcePerson[]> {
    if (!organizationId || people.length === 0) return people;
    const [members, departments] = await Promise.all([
      this.prisma.orgMember.findMany({
        where: { organizationId },
        include: { user: { select: { name: true } } }
      }),
      this.prisma.department.findMany({
        where: { organizationId },
        select: { id: true, name: true, parentId: true }
      })
    ]);
    const departmentPathById = new Map(this.flattenDepartmentPaths(departments).map((item) => [item.id, item.path]));
    const departmentCandidatesByName = new Map<string, string[]>();
    for (const member of members) {
      const userName = this.normalizeResourceLookup(member.user.name);
      const departmentPath = member.departmentId ? departmentPathById.get(member.departmentId) : '';
      if (!userName || !departmentPath) continue;
      const list = departmentCandidatesByName.get(userName) ?? [];
      list.push(departmentPath);
      departmentCandidatesByName.set(userName, list);
    }
    const systemDepartmentByName = new Map<string, string>();
    for (const [name, departments] of departmentCandidatesByName) {
      if (departments.length === 1) {
        systemDepartmentByName.set(name, departments[0]);
      }
    }
    return people.map((person) => {
      const systemDepartment = systemDepartmentByName.get(this.normalizeResourceLookup(person.name));
      return systemDepartment ? { ...person, department: systemDepartment } : person;
    });
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

  private normalizeResourceLookup(value: unknown) {
    return String(value ?? '').trim().toLowerCase();
  }

  private resourcePersonKey(value: Pick<ResourcePerson | ResourceAllocation | ResourceAvailability, 'personId' | 'name'>): string {
    return (value.personId || value.name || '').trim();
  }

  private effectiveAllocationPercent(allocation: ResourceAllocation, person: ResourcePerson): number {
    if (allocation.allocationDays > 0) {
      const days = this.inclusiveDayCount(allocation.startDate, allocation.endDate);
      const dailyCapacity = person.dailyCapacity > 0 ? person.dailyCapacity : 1;
      if (days > 0) return Math.round((allocation.allocationDays / days / dailyCapacity) * 10000) / 100;
    }
    return allocation.allocationPercent;
  }

  private inclusiveDayCount(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00+08:00`).getTime();
    const end = new Date(`${(endDate || startDate)}T00:00:00+08:00`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
    return Math.floor((end - start) / 86_400_000) + 1;
  }

  private resourceLoadStatus(allocatedPercent: number, availablePercent: number): ResourceLoadStatus {
    if (availablePercent <= 0) return 'unavailable';
    if (allocatedPercent > availablePercent) return 'overloaded';
    if (allocatedPercent >= availablePercent * 0.9) return 'saturated';
    if (allocatedPercent > 0) return 'normal';
    return 'idle';
  }

  private buildResourceCalendarDays(length: number): string[] {
    const now = new Date();
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    return Array.from({ length }).map((_, index) => this.formatDateUtc(new Date(start.getTime() + index * 24 * 60 * 60 * 1000)));
  }

  private isDateInRange(date: string, startDate: string, endDate: string): boolean {
    return Boolean(date && startDate && endDate && date >= startDate && date <= endDate);
  }

  private normalizePositiveNumber(value: string, fallback: number): number {
    const normalized = Number(String(value || '').replace('%', '').trim());
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
  }

  private normalizePercent(value: string, fallback: number): number {
    const text = String(value || '').trim();
    if (!text) return fallback;
    const raw = Number(text.replace('%', ''));
    if (!Number.isFinite(raw)) return fallback;
    return Math.max(0, Math.min(300, raw <= 1 && !text.includes('%') ? raw * 100 : raw));
  }

  private buildRoadmapTimeAxis(items: Array<Pick<DeliveryRoadmapItem, 'targetDate' | 'targetQuarter'>>): DeliveryRoadmapResponse['timeAxis'] {
    const dates = items.flatMap((item) => {
      if (item.targetDate) return [item.targetDate];
      const quarter = this.parseQuarter(item.targetQuarter);
      return quarter ? [this.quarterStart(quarter.year, quarter.quarter), this.quarterEnd(quarter.year, quarter.quarter)] : [];
    });
    if (dates.length === 0) {
      return { years: [], quarters: [], startDate: '', endDate: '' };
    }
    const sortedDates = dates.filter(Boolean).sort();
    const first = new Date(`${sortedDates[0]}T00:00:00.000Z`);
    const last = new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00.000Z`);
    const startQuarter = Math.floor(first.getUTCMonth() / 3) + 1;
    const endQuarter = Math.floor(last.getUTCMonth() / 3) + 1;
    const quarters: DeliveryRoadmapQuarter[] = [];
    for (let year = first.getUTCFullYear(); year <= last.getUTCFullYear(); year += 1) {
      const fromQ = year === first.getUTCFullYear() ? startQuarter : 1;
      const toQ = year === last.getUTCFullYear() ? endQuarter : 4;
      for (let quarter = fromQ; quarter <= toQ; quarter += 1) {
        quarters.push({
          key: `${year}-Q${quarter}`,
          year,
          quarter,
          label: `Q${quarter}`,
          start: this.quarterStart(year, quarter),
          end: this.quarterEnd(year, quarter)
        });
      }
    }
    return {
      years: Array.from(new Set(quarters.map((item) => item.year))),
      quarters,
      startDate: quarters[0]?.start || '',
      endDate: quarters[quarters.length - 1]?.end || ''
    };
  }

  private computeRoadmapXPercent(item: Pick<DeliveryRoadmapItem, 'targetDate' | 'targetQuarter'>, startDate: string, endDate: string): number {
    if (!startDate || !endDate) return 50;
    const target = item.targetDate || this.quarterMidpoint(item.targetQuarter);
    if (!target) return 50;
    const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
    const point = new Date(`${target}T00:00:00.000Z`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(point) || end <= start) return 50;
    return Math.max(0, Math.min(100, Math.round(((point - start) / (end - start)) * 10000) / 100));
  }

  private fieldValue(fields: Record<string, unknown>, desiredHeader: string): string {
    const candidates = String(desiredHeader || '')
      .split(/[|,，]/)
      .map((item) => this.normalizeFieldHeader(item))
      .filter(Boolean);
    const entry = Object.entries(fields).find(([key]) => candidates.includes(this.normalizeFieldHeader(key)));
    return this.toPlainText(entry?.[1]);
  }

  private findBlankHeaderValue(fields: Record<string, unknown>): string {
    const blankEntry = Object.entries(fields).find(([key]) => this.normalizeFieldHeader(key) === '');
    return this.toPlainText(blankEntry?.[1]);
  }

  private normalizeFieldHeader(value: string): string {
    return String(value || '').replace(/\s+/g, '').trim();
  }

  private toPlainText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    if (Array.isArray(value)) {
      return value.map((item) => this.toPlainText(item)).filter(Boolean).join('、');
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const preferred = record.text ?? record.name ?? record.value ?? record.en_name ?? record.email;
      if (preferred !== undefined) return this.toPlainText(preferred);
      return Object.values(record).map((item) => this.toPlainText(item)).filter(Boolean).join('、');
    }
    return '';
  }

  private normalizeRiskLight(value: string): ClusterRiskLight {
    const text = value.replace(/\s+/g, '');
    if (text.includes('红')) return '红灯';
    if (text.includes('黄')) return '黄灯';
    if (text.includes('绿')) return '绿灯';
    return '未填';
  }

  private normalizeYesNo(value: string): boolean | null {
    const text = value.trim().toLowerCase();
    if (!text) return null;
    if (['是', 'yes', 'y', 'true', '1', '有'].includes(text)) return true;
    if (['否', 'no', 'n', 'false', '0', '无'].includes(text)) return false;
    return null;
  }

  private normalizeBoolean(value: string): boolean {
    const text = value.trim().toLowerCase();
    return ['是', 'yes', 'y', 'true', '1', '有', 'tbd', '待定'].includes(text);
  }

  private normalizeDateText(value: string): string {
    const text = value.trim();
    if (!text) return '';
    if (/^\d+$/.test(text)) {
      const raw = Number(text);
      const timestamp = raw > 9999999999 ? raw : raw * 1000;
      const parsed = new Date(timestamp);
      if (!Number.isNaN(parsed.getTime())) return this.formatDateWithOffset(parsed, 8);
    }
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
      const [year, month, day] = text.split('-').map(Number);
      return this.formatDateUtc(new Date(Date.UTC(year, month - 1, day)));
    }
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)) {
      const [year, month, day] = text.split('/').map(Number);
      return this.formatDateUtc(new Date(Date.UTC(year, month - 1, day)));
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return this.formatDateUtc(parsed);
    return '';
  }

  private normalizeQuarterText(value: string): string {
    const text = value.trim().toUpperCase().replace(/\s+/g, '');
    const match = text.match(/^(\d{4})[-/]?Q([1-4])$/);
    if (!match) return '';
    return `${match[1]}-Q${match[2]}`;
  }

  private quarterKeyFromDate(value: string): string {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  }

  private parseQuarter(value: string): { year: number; quarter: number } | null {
    const normalized = this.normalizeQuarterText(value);
    const match = normalized.match(/^(\d{4})-Q([1-4])$/);
    if (!match) return null;
    return { year: Number(match[1]), quarter: Number(match[2]) };
  }

  private quarterStart(year: number, quarter: number): string {
    return this.formatDateUtc(new Date(Date.UTC(year, (quarter - 1) * 3, 1)));
  }

  private quarterEnd(year: number, quarter: number): string {
    return this.formatDateUtc(new Date(Date.UTC(year, quarter * 3, 0)));
  }

  private quarterMidpoint(value: string): string {
    const quarter = this.parseQuarter(value);
    if (!quarter) return '';
    const start = new Date(`${this.quarterStart(quarter.year, quarter.quarter)}T00:00:00.000Z`).getTime();
    const end = new Date(`${this.quarterEnd(quarter.year, quarter.quarter)}T00:00:00.000Z`).getTime();
    return this.formatDateUtc(new Date(Math.round((start + end) / 2)));
  }

  private formatDateUtc(date: Date): string {
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateWithOffset(date: Date, offsetHours: number): string {
    return this.formatDateUtc(new Date(date.getTime() + offsetHours * 60 * 60 * 1000));
  }

  private inferQualityLevel(value: string): string {
    if (value.includes('高')) return '高';
    if (value.includes('中')) return '中';
    if (value.includes('低')) return '低';
    return '';
  }

  private riskSortWeight(value: ClusterRiskLight): number {
    if (value === '红灯') return 0;
    if (value === '黄灯') return 1;
    if (value === '绿灯') return 2;
    return 3;
  }
}
