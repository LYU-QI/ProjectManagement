import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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
  projectStage: string;
  deliveryStatus: string;
  ownerOne: string;
  pm: string;
  ownerPm: string;
  riskLight: ClusterRiskLight;
  riskTrend: string;
  riskCategory: string;
  keyRiskSummary: string;
  riskImpact: string;
  deliveryScope: string;
  hasKeyDemo: boolean | null;
  weeklyProgress: string;
  dailyRiskHelp: string;
  urgentStaffingGap: string;
  riskResolution: string;
  nextAction: string;
  actionOwner: string;
  actionDueDate: string;
  needsEscalation: string;
  escalationRequest: string;
  qualityGap: string;
  qualityLevel: string;
  updatedAt: string;
  updatedBy: string;
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
  vehicleVersionName: string;
  milestoneType: string;
  plannedDeliveryDate: string;
  committedDeliveryDate: string;
  actualDeliveryDate: string;
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
  skillTags: string;
  level: string;
  location: string;
  dailyCapacity: number;
  status: string;
  isKeyResource: string;
  resourceStatus: string;
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
  allocationConfirmStatus: string;
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

type ProjectWeeklyReportSource = 'mixed' | 'local' | 'config_missing' | 'error';

type ProjectWeeklyMetric = {
  label: string;
  value: string;
  sub: string;
  tone: 'good' | 'warn' | 'danger' | '';
};

type ProjectWeeklyHealthRow = {
  dimension: string;
  metric: string;
  percent: number;
  trend: string;
  judgement: string;
  tone: 'good' | 'warn' | 'danger';
  action: string;
};

type ProjectWeeklyBugMetricKey = 'totalIssues' | 'solvedIssues' | 'pendingIssues' | 'totalP0Issues' | 'adjustedTotalP0Issues' | 'pendingP0Issues';

type ProjectWeeklyBugMetricValues = Record<ProjectWeeklyBugMetricKey, number>;

type ProjectWeeklyReportResponse = {
  generatedAt: string;
  source: ProjectWeeklyReportSource;
  error?: string;
  project: {
    id: number;
    name: string;
    alias: string;
    pm: string;
    stage: string;
    riskLight: ClusterRiskLight;
    period: { weekStart: string; weekEnd: string };
    dataSource: string;
  };
  metrics: ProjectWeeklyMetric[];
  bugStats: {
    cards: Array<{ label: string; value: number; sub?: string; explain?: string; delta?: number; baselineValue?: number; baselineDate?: string }>;
    p0p1StatusDistribution: Array<{ name: string; value: number; percent: number; color: string }>;
    p0StatusDistribution: Array<{ name: string; value: number; percent: number; color: string }>;
    p1StatusDistribution: Array<{ name: string; value: number; percent: number; color: string }>;
    p0TechnicalModuleDistribution: Array<{ name: string; value: number }>;
  };
  pendingP0Bugs: Array<{
    id: string;
    title: string;
    technicalModules: string[];
    expectedFixDate: string;
    status: string;
    source: string;
    rootCause: string;
    assignee: string;
    severity: string;
  }>;
  health: ProjectWeeklyHealthRow[];
  progress: {
    weeklyProgress: string;
    deliveryScope: string;
    keyDemo: string;
  };
  milestones: Array<{ name: string; due: string; status: string; tone: 'good' | 'warn' | 'danger'; owner: string }>;
  discussions: Array<{ index: string; topic: string; technicalPoint: string; owner: string; plannedDate: string; progress: string; solution: string; bugCount: number; tone: 'good' | 'warn' | 'danger' }>;
  risks: Array<{ title: string; impact: string; owner: string; due: string; status: string; tone: 'good' | 'warn' | 'danger'; support: string }>;
  qualityCards: ProjectWeeklyMetric[];
  tests: Array<{ module: string; cases: number; executed: number; passRate: number; failedBlocked: string; tone: 'good' | 'warn' | 'danger'; conclusion: string }>;
  ranks: Array<{ title: string; items: Array<{ name: string; value: number }> }>;
  trends: Array<{
    id: string;
    label: string;
    title: string;
    description: string;
    value: string;
    unit: string;
    chart: 'line' | 'stacked';
    conclusion: string;
    conclusionTone: 'good' | 'warn' | 'danger';
    days: string[];
    series: Array<{ name: string; color: string; unit?: string; dashed?: boolean; values: number[] }>;
    variants?: Array<{
      key: string;
      label: string;
      series: Array<{ name: string; color: string; unit?: string; dashed?: boolean; values: number[] }>;
    }>;
  }>;
  aiSummary: {
    conclusion: string;
    risks: string[];
    actions: string[];
    nextWeek: string[];
  };
};

type FeatureListBoardItem = {
  featureId: string;
  domain: string;
  secondLevel: string;
  thirdLevel: string;
  query: string;
  developer: string;
  caseCount: number;
  passRate: number;
  testStatus: string;
  testConclusion: string;
  acceptanceStatus: string;
  isClosed: boolean;
  linkedBugIds: string;
  owner: string;
  plannedCloseDate: string;
  actualCloseDate: string;
  note: string;
  tone: 'good' | 'warn' | 'danger';
};

type FeatureListBoardResponse = {
  generatedAt: string;
  source: 'feishu' | 'config_missing' | 'error';
  error?: string;
  project: { id: number; name: string; dataSource: string };
  summary: {
    totalFeatures: number;
    effectiveFeatures: number;
    domainCount: number;
    domainEmptyCount: number;
    secondLevelCount: number;
    secondLevelEmptyCount: number;
    thirdLevelCount: number;
    thirdLevelEmptyCount: number;
    rawQueryCount: number;
    rawQueryEmptyCount: number;
    queryCount: number;
    queryEmptyCount: number;
    caseCount: number;
    averagePassRate: number;
    acceptedCount: number;
    failedCount: number;
    pendingCloseCount: number;
    linkedBugFeatureCount: number;
    closureRate: number;
  };
  metrics: ProjectWeeklyMetric[];
  domains: Array<{
    name: string;
    featureCount: number;
    caseCount: number;
    averagePassRate: number;
    closureRate: number;
    failedCount: number;
    pendingCount: number;
    tone: 'good' | 'warn' | 'danger';
  }>;
  riskDomains: Array<{ name: string; reason: string; action: string; tone: 'good' | 'warn' | 'danger' }>;
  developers: Array<{ name: string; featureCount: number; caseCount: number; averagePassRate: number; pendingCount: number; tone: 'good' | 'warn' | 'danger' }>;
  items: FeatureListBoardItem[];
};

type ProjectWeeklySourceType = 'status_risk' | 'tasks' | 'bugs' | 'tests' | 'resources' | 'milestones' | 'discussion_plans' | 'feature_list';

type ProjectWeeklySourceResult = {
  sourceType: ProjectWeeklySourceType;
  label: string;
  source: 'feishu' | 'config_missing' | 'error';
  error: string;
  items: Array<{ fields?: Record<string, unknown> }>;
};

const CLUSTER_FIELD_MAP: Record<keyof Omit<ClusterRiskBoardItem, 'hasKeyDemo'> | 'keyDemo', string> = {
  recordId: 'record_id',
  index: '序号',
  projectName: '项目名称|重点项目|项目|名称',
  projectId: '项目ID（未立项不填）|项目ID|项目编号',
  projectStage: '项目阶段|阶段',
  deliveryStatus: '交付状态|项目交付状态',
  ownerOne: '项目1号位|1号位|项目负责人',
  pm: 'PM|项目经理',
  ownerPm: '项目1号位和PM|PM|项目经理|负责人',
  riskLight: '风险情况',
  riskTrend: '风险趋势',
  riskCategory: '主要风险类型|风险类型',
  keyRiskSummary: '关键风险摘要|风险摘要',
  riskImpact: '风险影响范围|影响范围',
  deliveryScope: '交付范围',
  keyDemo: '近期重点演示',
  weeklyProgress: '周进展（PM）',
  dailyRiskHelp: 'Daily风险求助（PM）',
  urgentStaffingGap: '最紧急的缺人情况|最紧急缺人情况|缺人情况|最紧急的缺人情况（PM视角）',
  riskResolution: '风险解决情况',
  nextAction: '下一步动作',
  actionOwner: '动作负责人|下一步动作负责人',
  actionDueDate: '动作截止时间|下一步动作截止时间',
  needsEscalation: '是否需管理层支持|是否需要管理层支持',
  escalationRequest: '需支持事项|管理层支持事项',
  qualityGap: '质量状态与GAP-叶芳',
  qualityLevel: '质量等级',
  updatedAt: '更新时间|更新日期',
  updatedBy: '更新人'
};

const DELIVERY_ROADMAP_FIELD_MAP: Record<string, string> = {
  categoryL1: 'category_l1|一级分类',
  categoryL2: 'category_l2|二级分类',
  ySortOrder: 'y_sort_order|排序权重',
  targetDate: 'target_date|精确日期',
  targetQuarter: 'target_quarter|所属季度',
  isTbd: 'is_tbd|是否待定',
  vehicleVersionName: '车型/版本名称|车型版本名称|版本名称',
  milestoneType: '里程碑类型|节点类型',
  plannedDeliveryDate: '计划交付日期|计划日期',
  committedDeliveryDate: '承诺交付日期|承诺日期',
  actualDeliveryDate: '实际完成日期|实际交付日期|完成日期',
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
  skillTags: '技能标签|技能',
  level: 'level|职级',
  location: 'location|地点',
  dailyCapacity: 'daily_capacity|日标准产能',
  personStatus: 'status|状态',
  isKeyResource: '是否关键资源|关键资源',
  resourceStatus: '资源状态',
  personRemark: 'remark|备注',
  allocationId: 'allocation_id|分配ID',
  projectId: 'project_id|项目ID',
  projectName: 'project_name|项目名称',
  startDate: 'start_date|开始日期',
  endDate: 'end_date|结束日期|结束时间',
  allocationPercent: 'allocation_percent|投入比例',
  allocationDays: 'allocation_days|投入人天',
  allocationType: 'allocation_type|分配类型',
  allocationConfirmStatus: '分配确认状态|确认状态',
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
  private readonly logger = new Logger(DashboardService.name);
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

  async projectWeeklyReport(
    projectId: number,
    query: { weekStart?: string; weekEnd?: string },
    actor?: AuthActor & { organizationId?: string }
  ): Promise<ProjectWeeklyReportResponse> {
    await this.accessService.assertProjectAccess(actor, projectId);
    const period = this.resolveWeeklyPeriod(query.weekStart, query.weekEnd);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { name: true, username: true } },
        weeklyDataSources: true
      }
    });
    if (!project) throw new BadRequestException('项目不存在');

    const [
      workItems,
      requirements,
      bugs,
      testCases,
      testPlans,
      testPlanItems,
      milestones,
      worklogs,
      statusRiskResult,
      weeklyBugResult,
      weeklyTestResult,
      weeklyResourceResult,
      weeklyMilestoneResult,
      weeklyDiscussionResult,
      clusterResult,
      resourceResult
    ] = await Promise.all([
      this.prisma.workItem.findMany({ where: { projectId } }),
      this.prisma.requirement.findMany({ where: { projectId } }),
      this.prisma.bug.findMany({ where: { projectId } }),
      this.prisma.testCase.findMany({ where: { projectId } }),
      this.prisma.testPlan.findMany({ where: { projectId } }),
      this.prisma.testPlanItem.findMany({
        where: { plan: { projectId } },
        include: { testCase: { select: { title: true } } }
      }),
      this.prisma.milestone.findMany({ where: { projectId } }),
      this.prisma.worklog.findMany({ where: { projectId } }),
      this.readProjectWeeklySource(project, 'status_risk', '项目状态/风险表'),
      this.readProjectWeeklySource(project, 'bugs', '缺陷表'),
      this.readProjectWeeklySource(project, 'tests', '测试概况表'),
      this.readProjectWeeklySource(project, 'resources', '资源投入表'),
      this.readProjectWeeklySource(project, 'milestones', '交付里程碑表'),
      this.readProjectWeeklySource(project, 'discussion_plans', '专项讨论计划清单'),
      this.clusterRiskBoard(actor).catch((err) => this.emptyClusterRiskBoard('error', err?.message || '集群风险状态大看板数据加载失败。')),
      this.resourceCalendar(actor).catch((err) => this.emptyResourceCalendar('error', err?.message || '项目资源日历大看板数据加载失败。'))
    ]);

    const weeklySourceResults = [statusRiskResult, weeklyBugResult, weeklyTestResult, weeklyResourceResult, weeklyMilestoneResult, weeklyDiscussionResult];
    const weeklyStatusItem = statusRiskResult.items[0]?.fields
      ? this.normalizeWeeklyStatusRisk(statusRiskResult.items[0].fields, project)
      : undefined;
    const clusterItem = weeklyStatusItem || this.findClusterItemForProject(clusterResult.items || [], project);

    const reportBugs = weeklyBugResult.items.length > 0
      ? weeklyBugResult.items.map((record) => this.normalizeWeeklyBug(record.fields || {}))
      : bugs;
    const openBugStatuses: BugStatus[] = [BugStatus.open, BugStatus.in_progress];
    const openBugs = reportBugs.filter((bug) => openBugStatuses.includes(bug.status));
    const today = this.formatDateWithOffset(new Date(), 8);
    const todayDueBugs = reportBugs.filter((bug) => this.weeklyBugExpectedDate(bug) === today);
    const todayVerifiedBugs = todayDueBugs.filter((bug) => this.isWeeklyBugVerified(bug));
    const overdueBugs = reportBugs.filter((bug) => {
      const expectedDate = this.weeklyBugExpectedDate(bug);
      return Boolean(expectedDate && expectedDate < today && !this.isWeeklyBugVerified(bug));
    });
    const taskCompletionRate = todayDueBugs.length > 0 ? Math.round((todayVerifiedBugs.length / todayDueBugs.length) * 100) : 0;
    const seriousBugs = openBugs.filter((bug) => ['critical', 'blocker'].includes(String(bug.severity)));
    const developmentRiskBugs = openBugs.filter((bug) => this.isDevelopmentRiskBug(bug));
    const newBugs = reportBugs.filter((bug) => this.dateInPeriod(this.dateOnly(bug.createdAt), period.weekStart, period.weekEnd));
    const closedBugs = reportBugs.filter((bug) => this.dateInPeriod(this.dateOnly(bug.closedAt || bug.resolvedAt), period.weekStart, period.weekEnd));
    const bugMetricValues = this.calculateProjectWeeklyBugMetricValues(reportBugs);
    const bugStats = await this.buildProjectWeeklyBugStats(project.id, reportBugs, bugMetricValues);
    const pendingP0BugList = this.buildProjectWeeklyPendingP0Bugs(reportBugs);

    const weeklyTests = weeklyTestResult.items.map((record) => this.normalizeWeeklyTestSummary(record.fields || {}));
    const executedTestItems = weeklyTests.length > 0 ? [] : testPlanItems.filter((item) => Boolean(item.result));
    const passedTestItems = weeklyTests.length > 0 ? [] : testPlanItems.filter((item) => item.result === 'passed');
    const failedTestItems = weeklyTests.length > 0 ? [] : testPlanItems.filter((item) => item.result === 'failed');
    const blockedTestItems = weeklyTests.length > 0
      ? weeklyTests.filter((item) => item.blocked > 0).map((item) => ({ testCase: { title: item.module || item.round || '测试阻塞' } }))
      : testPlanItems.filter((item) => item.result === 'blocked');
    const weeklyTestCases = weeklyTests.reduce((sum, item) => sum + item.cases, 0);
    const weeklyTestExecuted = weeklyTests.reduce((sum, item) => sum + item.executed, 0);
    const weeklyTestPassed = weeklyTests.reduce((sum, item) => sum + item.passed, 0);
    const weeklyTestFailed = weeklyTests.reduce((sum, item) => sum + item.failed, 0);
    const weeklyTestBlocked = weeklyTests.reduce((sum, item) => sum + item.blocked, 0);
    const testExecutionRate = weeklyTests.length > 0
      ? (weeklyTestCases > 0 ? Math.round((weeklyTestExecuted / weeklyTestCases) * 100) : 0)
      : (testPlanItems.length > 0 ? Math.round((executedTestItems.length / testPlanItems.length) * 100) : 0);
    const testPassRate = weeklyTests.length > 0
      ? (weeklyTestExecuted > 0 ? Math.round((weeklyTestPassed / weeklyTestExecuted) * 100) : 0)
      : (executedTestItems.length > 0 ? Math.round((passedTestItems.length / executedTestItems.length) * 100) : 0);

    const weeklyResourceRows = weeklyResourceResult.items.map((record) => this.normalizeWeeklyResource(record.fields || {}));
    const projectAllocations = weeklyResourceRows.length > 0
      ? weeklyResourceRows
      : (resourceResult.allocations || []).filter((item) => this.matchesProjectIdentity(item.projectId, item.projectName, project));
    const activeProjectAllocations = projectAllocations.filter((item) => this.overlapDayCount(item.startDate, item.endDate, period.weekStart, period.weekEnd) > 0);
    const resourceDays = Math.round(projectAllocations.reduce((sum, item) => {
      return sum + this.weeklyAllocationDays(item, period.weekStart, period.weekEnd);
    }, 0) * 10) / 10;
    const resourcePeople = new Set(activeProjectAllocations.map((item) => item.name || item.personId).filter(Boolean));
    const resourceConflicts = weeklyResourceRows.length > 0
      ? activeProjectAllocations.filter((item) => 'conflict' in item && item.conflict)
      : (resourceResult.conflicts || []).filter((conflict) => activeProjectAllocations.some((allocation) => allocation.name === conflict.name || allocation.personId === conflict.personId));
    const reportMilestones = weeklyMilestoneResult.items.length > 0
      ? weeklyMilestoneResult.items.map((record) => this.normalizeWeeklyMilestone(record.fields || {}))
      : milestones;
    const discussions = this.attachWeeklyDiscussionBugCounts(
      weeklyDiscussionResult.items.map((record) => this.normalizeWeeklyDiscussion(record.fields || {})),
      reportBugs
    );

    const riskLight = clusterItem?.riskLight || '未填';
    const riskCount = [
      clusterItem?.dailyRiskHelp,
      clusterItem?.urgentStaffingGap,
      clusterItem?.keyRiskSummary,
      clusterItem?.riskResolution
    ].filter((item) => String(item || '').trim()).length;
    const developmentRiskCount = developmentRiskBugs.length;
    const actionCount = openBugs.length;
    const keyDemo = clusterItem ? this.keyDemoText(clusterItem.hasKeyDemo) : '暂无近期重点演示数据';
    const qualityTone = seriousBugs.length > 0 || blockedTestItems.length > 0 ? 'danger' : openBugs.length > 0 || testPassRate < 85 ? 'warn' : 'good';
    const riskTone = riskLight === '红灯' || developmentRiskCount >= 5 ? 'danger' : riskLight === '黄灯' || developmentRiskCount > 0 ? 'warn' : 'good';
    const healthTone = riskTone === 'danger' || qualityTone === 'danger' || overdueBugs.length > 3 ? 'danger' : riskTone === 'warn' || qualityTone === 'warn' || overdueBugs.length > 0 ? 'warn' : 'good';
    const healthLabel = healthTone === 'danger' ? '高风险' : healthTone === 'warn' ? '关注' : '健康';

    const metrics: ProjectWeeklyMetric[] = [
      { label: '项目健康度', value: healthLabel, sub: `${riskLight}，${clusterItem?.riskTrend || '趋势待确认'}`, tone: healthTone },
      { label: '任务完成率', value: `${taskCompletionRate}%`, sub: `今日验证通过 ${todayVerifiedBugs.length}/${todayDueBugs.length}`, tone: taskCompletionRate >= 80 ? 'good' : taskCompletionRate >= 60 ? 'warn' : 'danger' },
      { label: '延期事项', value: String(overdueBugs.length), sub: `延期缺陷 ${overdueBugs.length} 条`, tone: overdueBugs.length > 3 ? 'danger' : overdueBugs.length > 0 ? 'warn' : 'good' },
      { label: '打开风险', value: String(developmentRiskCount), sub: '模型能力类 / 依赖MB协助', tone: riskTone },
      { label: '严重缺陷', value: String(seriousBugs.length), sub: `打开缺陷 ${openBugs.length} 个`, tone: seriousBugs.length > 0 ? 'danger' : openBugs.length > 0 ? 'warn' : 'good' },
      { label: '测试通过率', value: `${testPassRate}%`, sub: `执行率 ${testExecutionRate}%`, tone: testPassRate >= 85 ? 'good' : testPassRate >= 70 ? 'warn' : 'danger' },
      { label: '资源投入', value: String(resourceDays), sub: `${resourcePeople.size} 人，冲突 ${resourceConflicts.length} 项`, tone: resourceConflicts.length > 0 ? 'warn' : '' },
      { label: '待闭环动作', value: String(actionCount), sub: `待闭环缺陷 ${actionCount} 个`, tone: actionCount > 5 ? 'danger' : actionCount > 0 ? 'warn' : 'good' }
    ];

    const health: ProjectWeeklyHealthRow[] = [
      this.weeklyHealthRow('进度', `今日缺陷任务完成率 ${taskCompletionRate}%，延期缺陷 ${overdueBugs.length} 条`, taskCompletionRate, todayDueBugs.length > 0 ? `今日预计完成缺陷 ${todayDueBugs.length} 个` : '今日暂无预计完成缺陷', overdueBugs.length > 3 || taskCompletionRate < 60 ? '高风险' : overdueBugs.length > 0 || taskCompletionRate < 80 ? '关注' : '可控', overdueBugs.length > 3 || taskCompletionRate < 60 ? 'danger' : overdueBugs.length > 0 || taskCompletionRate < 80 ? 'warn' : 'good', '优先完成今日预计修复缺陷，并清理历史延期缺陷。'),
      this.weeklyHealthRow('风险', `开发风险 ${developmentRiskCount} 个，风险灯 ${riskLight}`, riskTone === 'good' ? 88 : riskTone === 'warn' ? 65 : 45, clusterItem?.riskTrend || '趋势待确认', riskTone === 'danger' ? '高风险' : riskTone === 'warn' ? '关注' : '可控', riskTone, '优先处理模型能力类和依赖 MB 协助类缺陷。'),
      this.weeklyHealthRow('质量', `打开缺陷 ${openBugs.length}，严重缺陷 ${seriousBugs.length}`, qualityTone === 'good' ? 88 : qualityTone === 'warn' ? 62 : 45, closedBugs.length >= newBugs.length ? '净缺陷下降' : '缺陷关闭不足', qualityTone === 'danger' ? '高风险' : qualityTone === 'warn' ? '关注' : '可控', qualityTone, 'P0/P1 缺陷优先修复并复测。'),
      this.weeklyHealthRow('测试', `执行率 ${testExecutionRate}%，通过率 ${testPassRate}%`, testPassRate, blockedTestItems.length > 0 ? `阻塞用例 ${blockedTestItems.length} 个` : '测试阻塞可控', testPassRate >= 85 ? '可控' : testPassRate >= 70 ? '关注' : '高风险', testPassRate >= 85 ? 'good' : testPassRate >= 70 ? 'warn' : 'danger', '补齐未执行用例，失败/阻塞用例同步责任人。'),
      this.weeklyHealthRow('资源', `投入 ${resourceDays} 人天，资源冲突 ${resourceConflicts.length} 项`, resourceConflicts.length > 0 ? 66 : 82, resourceConflicts.length > 0 ? '关键资源存在冲突' : '资源投入相对稳定', resourceConflicts.length > 0 ? '关注' : '可控', resourceConflicts.length > 0 ? 'warn' : 'good', '协调关键资源，避免演示和测试阶段排队。'),
      this.weeklyHealthRow('交付', `${reportMilestones.length} 个里程碑，近期演示：${keyDemo}`, this.deliveryHealthPercent(reportMilestones), this.overdueMilestoneCount(reportMilestones) > 0 ? '存在延期节点' : '交付节点可控', this.overdueMilestoneCount(reportMilestones) > 0 ? '关注' : '可控', this.overdueMilestoneCount(reportMilestones) > 0 ? 'warn' : 'good', '演示前完成主链路验收和材料收口。')
    ];

    const risks = this.buildProjectWeeklyRisks(clusterItem, seriousBugs, blockedTestItems);
    const tests = weeklyTests.length > 0
      ? this.buildProjectWeeklyTestsFromSummaries(weeklyTests)
      : this.buildProjectWeeklyTests(testCases, testPlans, testPlanItems, failedTestItems.length, blockedTestItems.length);
    const ranks = this.buildProjectWeeklyRanks(reportBugs, overdueBugs, seriousBugs, resourceConflicts);
    const trendPeriod = this.resolveRecentSevenDayPeriod(period.weekEnd);
    const trends = this.buildProjectWeeklyTrends(trendPeriod.start, trendPeriod.end, reportBugs, reportMilestones);
    const aiSummary = this.buildProjectWeeklyAiSummary(project.name, metrics, risks, taskCompletionRate, testPassRate, openBugs.length, seriousBugs.length);
    const sourceSummary = this.projectWeeklySourceSummary(weeklySourceResults);

    return {
      generatedAt: new Date().toISOString(),
      source: sourceSummary.connectedCount === weeklySourceResults.length ? 'mixed' : sourceSummary.connectedCount > 0 ? 'config_missing' : 'local',
      error: sourceSummary.error,
      project: {
        id: project.id,
        name: project.name,
        alias: project.alias || '',
        pm: clusterItem?.pm || clusterItem?.ownerPm || project.owner?.name || project.owner?.username || '未配置',
        stage: clusterItem?.projectStage || '未配置阶段',
        riskLight,
        period,
        dataSource: sourceSummary.label
      },
      metrics,
      bugStats,
      pendingP0Bugs: pendingP0BugList,
      health,
      progress: {
        weeklyProgress: clusterItem?.weeklyProgress || '暂无本周进展数据。',
        deliveryScope: clusterItem?.deliveryScope || '暂无交付范围数据，请在集群风险状态表中维护。',
        keyDemo
      },
      milestones: this.buildProjectWeeklyMilestones(reportMilestones, clusterItem, period.weekEnd),
      discussions,
      risks,
      qualityCards: [
        { label: '缺陷新增 / 关闭', value: `${newBugs.length} / ${closedBugs.length}`, sub: `净变化 ${newBugs.length - closedBugs.length}`, tone: newBugs.length > closedBugs.length ? 'warn' : 'good' },
        { label: '未关闭缺陷', value: String(openBugs.length), sub: `严重缺陷 ${seriousBugs.length} 个`, tone: seriousBugs.length > 0 ? 'danger' : openBugs.length > 0 ? 'warn' : 'good' },
        { label: '测试执行 / 通过', value: `${testExecutionRate}% / ${testPassRate}%`, sub: `失败 ${weeklyTests.length > 0 ? weeklyTestFailed : failedTestItems.length}，阻塞 ${weeklyTests.length > 0 ? weeklyTestBlocked : blockedTestItems.length}`, tone: blockedTestItems.length > 0 || testPassRate < 70 ? 'danger' : testPassRate < 85 ? 'warn' : 'good' }
      ],
      tests,
      ranks,
      trends,
      aiSummary
    };
  }

  async featureListBoard(
    projectId: number,
    actor?: AuthActor & { organizationId?: string }
  ): Promise<FeatureListBoardResponse> {
    await this.accessService.assertProjectAccess(actor, projectId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { weeklyDataSources: true }
    });
    if (!project) throw new BadRequestException('项目不存在');

    const source = await this.readProjectWeeklySource(project, 'feature_list', 'Feature List 验收表');
    if (source.source !== 'feishu') {
      return this.emptyFeatureListBoard(project, source.source, source.error || '请先配置 Feature List 数据源。');
    }

    const items = source.items
      .map((record) => this.normalizeFeatureListItem(record.fields || {}))
      .filter((item) => item.featureId || item.query || item.domain);
    const effectiveItems = items.filter((item) => !this.isFeatureListExcluded(item));
    const domains = this.buildFeatureListDomainStats(effectiveItems);
    const developers = this.buildFeatureListDeveloperStats(effectiveItems);
    const acceptedCount = effectiveItems.filter((item) => item.isClosed).length;
    const failedCount = effectiveItems.filter((item) => this.isFeatureListFailed(item)).length;
    const linkedBugFeatureCount = effectiveItems.filter((item) => item.linkedBugIds).length;
    const caseCount = effectiveItems.reduce((sum, item) => sum + item.caseCount, 0);
    const averagePassRate = this.averagePercent(effectiveItems.map((item) => item.passRate));
    const closureRate = effectiveItems.length > 0 ? Math.round((acceptedCount / effectiveItems.length) * 100) : 0;
    const pendingCloseCount = Math.max(0, effectiveItems.length - acceptedCount);
    const summary = {
      totalFeatures: items.length,
      effectiveFeatures: effectiveItems.length,
      domainCount: new Set(effectiveItems.map((item) => item.domain).filter(Boolean)).size,
      domainEmptyCount: effectiveItems.filter((item) => !item.domain).length,
      secondLevelCount: new Set(effectiveItems.map((item) => item.secondLevel).filter(Boolean)).size,
      secondLevelEmptyCount: effectiveItems.filter((item) => !item.secondLevel).length,
      thirdLevelCount: effectiveItems.filter((item) => item.thirdLevel).length,
      thirdLevelEmptyCount: effectiveItems.filter((item) => !item.thirdLevel).length,
      rawQueryCount: items.filter((item) => item.query).length,
      rawQueryEmptyCount: items.filter((item) => !item.query).length,
      queryCount: effectiveItems.filter((item) => item.query).length,
      queryEmptyCount: effectiveItems.filter((item) => !item.query).length,
      caseCount,
      averagePassRate,
      acceptedCount,
      failedCount,
      pendingCloseCount,
      linkedBugFeatureCount,
      closureRate
    };

    const riskDomains = domains
      .filter((item) => item.tone !== 'good')
      .slice(0, 6)
      .map((item) => ({
        name: item.name,
        reason: `通过率 ${item.averagePassRate}%，闭环率 ${item.closureRate}%，Fail ${item.failedCount} 个，待闭环 ${item.pendingCount} 个。`,
        action: '优先关联缺陷、明确责任人与计划闭环日期，推动客户复验。',
        tone: item.tone
      }));

    return {
      generatedAt: new Date().toISOString(),
      source: 'feishu',
      project: {
        id: project.id,
        name: project.name,
        dataSource: source.label
      },
      summary,
      metrics: [
        { label: 'Feature 总数', value: String(summary.totalFeatures), sub: `有效 ${summary.effectiveFeatures} 个`, tone: '' },
        { label: '一级功能数', value: String(summary.domainCount), sub: `去重数量，空记录 ${summary.domainEmptyCount} 条`, tone: '' },
        { label: '二级功能数', value: String(summary.secondLevelCount), sub: `去重数量，空记录 ${summary.secondLevelEmptyCount} 条`, tone: '' },
        { label: '三级功能数', value: String(summary.thirdLevelCount), sub: `非空记录数，空记录 ${summary.thirdLevelEmptyCount} 条`, tone: '' },
        { label: 'Query 总数', value: String(summary.rawQueryCount), sub: `原始记录口径，空记录 ${summary.rawQueryEmptyCount} 条`, tone: '' },
        { label: '有效 Query 数', value: String(summary.queryCount), sub: `有效 Feature 口径，空记录 ${summary.queryEmptyCount} 条`, tone: '' },
        { label: 'CASE 总数', value: String(summary.caseCount), sub: '按 CASE总数求和', tone: '' },
        { label: '平均通过率', value: `${summary.averagePassRate}%`, sub: '来自通过率字段', tone: summary.averagePassRate >= 85 ? 'good' : summary.averagePassRate >= 70 ? 'warn' : 'danger' },
        { label: '闭环率', value: `${summary.closureRate}%`, sub: '甲方验收通过 / 有效 Feature', tone: summary.closureRate >= 85 ? 'good' : summary.closureRate >= 70 ? 'warn' : 'danger' },
        { label: '验收通过', value: String(summary.acceptedCount), sub: '甲方验收状态=验收通过', tone: 'good' },
        { label: 'Fail / 待复验', value: String(summary.failedCount), sub: '测试Fail 或验收不通过', tone: summary.failedCount > 0 ? 'danger' : 'good' },
        { label: '关联缺陷', value: String(summary.linkedBugFeatureCount), sub: '关联缺陷ID 非空', tone: summary.linkedBugFeatureCount > 0 ? 'warn' : 'good' },
        { label: '待闭环', value: String(summary.pendingCloseCount), sub: '有效 Feature 未验收通过', tone: summary.pendingCloseCount > 0 ? 'warn' : 'good' }
      ],
      domains,
      riskDomains,
      developers,
      items: effectiveItems
        .sort((a, b) => Number(a.isClosed) - Number(b.isClosed) || a.passRate - b.passRate)
        .slice(0, 60)
    };
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

  private resolveWeeklyPeriod(weekStart?: string, weekEnd?: string) {
    const today = new Date();
    const day = today.getDay() || 7;
    const monday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - day + 1));
    const sunday = new Date(monday.getTime() + 6 * 86_400_000);
    const start = this.normalizeDateText(weekStart || '') || this.formatDateUtc(monday);
    const end = this.normalizeDateText(weekEnd || '') || this.formatDateUtc(sunday);
    return { weekStart: start, weekEnd: end >= start ? end : start };
  }

  private resolveRecentSevenDayPeriod(reportEnd: string) {
    const today = this.formatDateUtc(new Date());
    const end = reportEnd && reportEnd < today ? reportEnd : today;
    const endDate = new Date(`${end}T00:00:00.000Z`);
    const startDate = new Date(endDate.getTime() - 6 * 86_400_000);
    return { start: this.formatDateUtc(startDate), end };
  }

  private async readProjectFeishuTasks(project: {
    feishuAppToken?: string | null;
    feishuTableId?: string | null;
    feishuViewId?: string | null;
    name: string;
    id: number;
    alias?: string | null;
    weeklyDataSources?: Array<{ sourceType: string; appToken?: string | null; tableId?: string | null; viewId?: string | null }>;
  }) {
    const weeklyTaskSource = project.weeklyDataSources?.find((source) => source.sourceType === 'tasks');
    const appToken = weeklyTaskSource?.appToken || project.feishuAppToken;
    const tableId = weeklyTaskSource?.tableId || project.feishuTableId;
    const viewId = weeklyTaskSource?.viewId || project.feishuViewId;
    if (!appToken || !tableId) {
      return { source: 'config_missing' as const, error: '当前项目未配置项目级飞书任务表。', items: [] as Array<{ fields?: Record<string, unknown> }> };
    }
    try {
      const data = await this.feishuService.listRecords({
        pageSize: 500,
        viewId: viewId || undefined,
        opts: { appToken, tableId }
      });
      const items = (data.items || [])
        .map((item: any) => ({ fields: item?.fields || {} }))
        .filter((item) => this.matchesProjectIdentity(
          this.fieldValue(item.fields, '项目ID|projectId|project_id'),
          this.fieldValue(item.fields, '所属项目|项目名称|项目|project'),
          project
        ));
      return { source: 'feishu' as const, error: '', items };
    } catch (err: any) {
      return { source: 'error' as const, error: err?.message || '项目级飞书任务表读取失败。', items: [] as Array<{ fields?: Record<string, unknown> }> };
    }
  }

  private async readProjectWeeklySource(
    project: {
      name: string;
      id: number;
      alias?: string | null;
      weeklyDataSources?: Array<{ sourceType: string; appToken?: string | null; tableId?: string | null; viewId?: string | null }>;
    },
    sourceType: ProjectWeeklySourceType,
    label: string
  ): Promise<ProjectWeeklySourceResult> {
    const sourceConfig = project.weeklyDataSources?.find((source) => source.sourceType === sourceType);
    const appToken = sourceConfig?.appToken?.trim();
    const tableId = sourceConfig?.tableId?.trim();
    const viewId = sourceConfig?.viewId?.trim();
    if (!appToken || !tableId) {
      return { sourceType, label, source: 'config_missing', error: `${label}未配置。`, items: [] };
    }
    try {
      const data = sourceType === 'feature_list'
        ? await this.listAllFeatureListRecords(appToken, tableId, viewId || undefined)
        : await this.feishuService.listRecords({
            pageSize: 500,
            viewId: viewId || undefined,
            opts: { appToken, tableId }
          });
      const records = (data.items || []).map((item: any) => ({ fields: item?.fields || {} }));
      const items = sourceType === 'feature_list'
        ? records
        : records.filter((item) => {
            const rowProjectId = this.fieldValue(item.fields, '项目ID|项目编号|projectId|project_id');
            const rowProjectName = this.fieldValue(item.fields, '所属项目|项目名称|重点项目|项目|project|projectName');
            if (!rowProjectId && !rowProjectName) return true;
            return this.matchesProjectIdentity(rowProjectId, rowProjectName, project);
          });
      return { sourceType, label, source: 'feishu', error: '', items };
    } catch (err: any) {
      return { sourceType, label, source: 'error', error: err?.message || `${label}读取失败。`, items: [] };
    }
  }

  private async listAllFeatureListRecords(appToken: string, tableId: string, viewId?: string) {
    const items: Array<Record<string, unknown>> = [];
    let pageToken: string | undefined;

    for (let page = 0; page < 50; page += 1) {
      const data = await this.feishuService.listRecords({
        pageSize: 500,
        pageToken,
        viewId,
        opts: { appToken, tableId }
      });
      items.push(...(data.items || []));
      pageToken = data.has_more ? data.page_token : undefined;
      if (!pageToken) break;
    }

    return { items };
  }

  private projectWeeklySourceSummary(results: ProjectWeeklySourceResult[]) {
    const connected = results.filter((item) => item.source === 'feishu');
    const missing = results.filter((item) => item.source !== 'feishu');
    const connectedLabels = connected.map((item) => item.label);
    const missingLabels = missing.map((item) => item.label);
    const total = results.length;
    const label = connected.length === results.length
      ? `${total}张飞书周报表：${connectedLabels.join('、')}`
      : connected.length > 0
        ? `已接入 ${connected.length}/${total} 张周报表：${connectedLabels.join('、')}；未接入/失败：${missingLabels.join('、')}`
        : `未接入${total}张飞书周报表，当前使用本地/旧数据兜底`;
    const error = results.filter((item) => item.source === 'error').map((item) => `${item.label}：${item.error}`).join('；');
    return { connectedCount: connected.length, label, error };
  }

  private normalizeWeeklyStatusRisk(fields: Record<string, unknown>, project: { name: string; id: number; alias?: string | null }): ClusterRiskBoardItem {
    const item = this.normalizeClusterRecord({ fields }, CLUSTER_FIELD_MAP);
    return {
      ...item,
      projectName: item.projectName || project.name,
      projectId: item.projectId || String(project.id)
    };
  }

  private normalizeWeeklyBug(fields: Record<string, unknown>) {
    const title = this.fieldValue(fields, '问题描述|缺陷描述|标题|问题|Bug标题') || '未命名缺陷';
    const problemStatus = this.fieldValue(fields, '问题状态|状态|缺陷状态');
    const developmentStatus = this.fieldValue(fields, '状态(开发填)|开发状态|修复状态');
    const statusText = [
      problemStatus,
      developmentStatus
    ].filter(Boolean).join(' ');
    const severityText = this.fieldValue(fields, '严重等级|严重程度|P级|缺陷等级');
    const issueType = this.fieldValue(fields, '问题类型|问题分类|缺陷类型|缺陷分类|分类|类型|处理路径|RootCause|Rootcause|Root Cause|Root cause|rootCause|根因判断|issueType');
    const issueSource = this.fieldValue(fields, '问题来源|来源|缺陷来源|source');
    const rootCause = this.fieldValue(fields, 'RootCause|Rootcause|Root Cause|Root cause|rootCause|根因|根因判断|问题根因');
    const technicalModules = this.fieldValue(fields, '技术模块');
    const bugId = this.fieldValue(fields, '缺陷ID|Bug ID|bugId|ID') || title;
    const createdAt = this.parseWeeklyDate(this.fieldValue(fields, '问题创建时间|创建时间|创建日期|createdAt'))
      || this.parseBugIdTimestamp(bugId)
      || new Date(0);
    const closedAt = this.parseWeeklyDate(this.fieldValue(fields, '关闭时间|解决时间|完成时间|closedAt'));
    const verifiedAt = this.parseWeeklyDate(this.fieldValue(fields, '验证通过时间|验收通过时间|验证时间|通过时间|复测通过时间|verifiedAt|passedAt'));
    const expectedFixDate = this.normalizeDateText(this.fieldValue(fields, '预计修复时间|预计解决时间|期望修复时间|修复截止时间|预计完成时间|计划完成时间|计划修复时间|截止时间|dueDate'));
    return {
      id: bugId,
      title,
      status: this.normalizeWeeklyBugStatus(statusText),
      severity: this.normalizeWeeklyBugSeverity(severityText),
      assigneeName: this.fieldValue(fields, '负责人|指向人|处理人|责任人|assignee'),
      createdAt,
      closedAt,
      resolvedAt: closedAt,
      verifiedAt,
      expectedFixDate,
      rawStatusText: statusText,
      primaryStatusText: problemStatus || developmentStatus,
      rawSeverityText: severityText,
      issueType,
      issueSource,
      rootCause,
      technicalModules
    };
  }

  private normalizeWeeklyDiscussion(fields: Record<string, unknown>): ProjectWeeklyReportResponse['discussions'][number] {
    const plannedDate = this.normalizeDateText(this.fieldValue(fields, '计划完成时间|计划时间|完成时间|截止时间|计划日期'));
    const progress = this.fieldValue(fields, '当前进展|进展|状态|推进情况');
    const planText = this.fieldValue(fields, '计划完成时间|计划时间|完成时间|截止时间|计划日期');
    const today = this.formatDateWithOffset(new Date(), 8);
    const progressText = this.normalizeBugText(progress);
    const isDone = ['完成', '已解决', '已闭环', 'done', 'closed'].some((key) => progressText.includes(this.normalizeBugText(key)));
    const isTbd = this.normalizeBugText(planText).includes('tbd') || !plannedDate;
    const isOverdue = Boolean(plannedDate && plannedDate < today && !isDone);
    const tone: 'good' | 'warn' | 'danger' = isOverdue ? 'danger' : isTbd ? 'warn' : isDone ? 'good' : 'warn';

    return {
      index: this.fieldValue(fields, '序号|编号|ID|id'),
      topic: this.fieldValue(fields, '专项名|专项名称|专项|主题') || '未命名专项',
      technicalPoint: this.fieldValue(fields, '攻坚技术点|技术点|攻坚点|关键技术点'),
      owner: this.fieldValue(fields, '负责人|责任人|Owner|owner'),
      plannedDate: plannedDate || planText,
      progress,
      solution: this.fieldValue(fields, '主要解决问题|解决问题|问题|主要问题'),
      bugCount: 0,
      tone
    };
  }

  private attachWeeklyDiscussionBugCounts(
    discussions: ProjectWeeklyReportResponse['discussions'],
    bugs: unknown[]
  ): ProjectWeeklyReportResponse['discussions'] {
    const highPriorityBugs = bugs.filter((bug) => {
      const severityText = this.bugSeverityText(bug);
      return this.normalizeBugText(severityText).includes('p0')
        || this.normalizeBugText(severityText).includes('p1')
        || String((bug as { severity?: unknown })?.severity || '') === 'blocker'
        || String((bug as { severity?: unknown })?.severity || '') === 'critical';
    });
    return discussions.map((discussion) => {
      const keywords = this.weeklyDiscussionModuleKeywords(discussion.topic);
      const bugCount = highPriorityBugs.filter((bug) => {
        const modules = this.splitBugModules((bug as { technicalModules?: string | null })?.technicalModules || '');
        const primaryModule = modules[0] || '未填写';
        const moduleText = this.normalizeBugText(primaryModule);
        return keywords.some((keyword) => moduleText === keyword);
      }).length;
      return { ...discussion, bugCount };
    });
  }

  private weeklyDiscussionModuleKeywords(topic: string): string[] {
    const text = this.normalizeBugText(topic);
    const aliases: Record<string, string[]> = {
      '主链路': ['主链路'],
      '导航': ['导航专项'],
      '端状态': ['端状态'],
      'fc': ['车控fc', 'fc']
    };
    const matched = Object.entries(aliases).find(([key]) => text.includes(this.normalizeBugText(key)));
    const values = matched ? matched[1] : [topic];
    return Array.from(new Set(values.map((item) => this.normalizeBugText(item)).filter(Boolean)));
  }

  private emptyFeatureListBoard(
    project: { id: number; name: string },
    source: 'config_missing' | 'error',
    error: string
  ): FeatureListBoardResponse {
    return {
      generatedAt: new Date().toISOString(),
      source,
      error,
      project: { id: project.id, name: project.name, dataSource: 'Feature List 验收表' },
      summary: {
        totalFeatures: 0,
        effectiveFeatures: 0,
        domainCount: 0,
        domainEmptyCount: 0,
        secondLevelCount: 0,
        secondLevelEmptyCount: 0,
        thirdLevelCount: 0,
        thirdLevelEmptyCount: 0,
        queryCount: 0,
        queryEmptyCount: 0,
        rawQueryCount: 0,
        rawQueryEmptyCount: 0,
        caseCount: 0,
        averagePassRate: 0,
        acceptedCount: 0,
        failedCount: 0,
        pendingCloseCount: 0,
        linkedBugFeatureCount: 0,
        closureRate: 0
      },
      metrics: [],
      domains: [],
      riskDomains: [],
      developers: [],
      items: []
    };
  }

  private normalizeFeatureListItem(fields: Record<string, unknown>): FeatureListBoardItem {
    const testStatus = this.fieldValue(fields, '测试状态|测试进度|测试阶段|测试状态（自动）|测试执行状态');
    const testConclusion = this.fieldValue(fields, '测试结论|测试结果|内部测试结论|测试通过情况|测试验收结论|验收测试结论') || testStatus || '待测试';
    const acceptanceStatus = this.fieldValue(fields, '甲方验收状态|奔驰判断是否通过|客户验收状态|验收状态');
    const closedText = this.fieldValue(fields, '是否闭环|闭环状态');
    const passRate = this.normalizeFeaturePassRate(this.fieldValueByPriority(fields, [
      '通过率',
      '第四轮测试通过率',
      '第三轮测试通过率',
      '第二轮测试通过率',
      '第一轮测试通过率',
      'passRate'
    ]));
    const linkedBugIds = this.fieldValue(fields, '关联缺陷ID|关联缺陷|缺陷ID|bagcaseid');
    const isClosed = this.isFeatureListClosed(acceptanceStatus, closedText);
    const failed = this.isFeatureListFailed({ testConclusion, acceptanceStatus } as FeatureListBoardItem);
    const tone: 'good' | 'warn' | 'danger' = isClosed
      ? 'good'
      : failed || passRate < 60
        ? 'danger'
        : passRate < 85 || linkedBugIds
          ? 'warn'
          : 'good';
    return {
      featureId: this.fieldValue(fields, 'Feature ID|FeatureID|功能ID|featureId'),
      domain: this.fieldValue(fields, '一级功能|功能域|文本 6|文本6|模块') || '未分组',
      secondLevel: this.fieldValue(fields, '二级功能|二级模块'),
      thirdLevel: this.fieldValue(fields, '三级功能|三级模块'),
      query: this.fieldValue(fields, '演示query|演示 Query|演示QUERY|query|Query|QUERY|用例|测试语料|问题描述'),
      developer: this.fieldValue(fields, '开发者|协作方|负责人') || '未分配',
      caseCount: this.toNumber(this.fieldValue(fields, 'CASE总数|CASE 数|Case总数|用例数')),
      passRate,
      testStatus,
      testConclusion,
      acceptanceStatus,
      isClosed,
      linkedBugIds,
      owner: this.fieldValue(fields, '当前责任人|责任人|负责人'),
      plannedCloseDate: this.normalizeDateText(this.fieldValue(fields, '计划闭环日期|计划完成时间|预计完成时间')),
      actualCloseDate: this.normalizeDateText(this.fieldValue(fields, '实际闭环日期|实际完成时间|关闭时间')),
      note: this.fieldValue(fields, '闭环备注|备注|说明'),
      tone
    };
  }

  private normalizeFeaturePassRate(value: string): number {
    const text = String(value || '').replace(/%/g, '').trim();
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed * 10) / 10));
  }

  private toNumber(value: string): number {
    const parsed = Number(String(value || '').replace(/[,%]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private isFeatureListClosed(acceptanceStatus: string, closedText: string): boolean {
    const text = `${acceptanceStatus || ''} ${closedText || ''}`.replace(/\s+/g, '').toLowerCase();
    return ['验收通过', '已闭环', 'closed', 'true', 'yes', '是'].some((key) => text.includes(key));
  }

  private isFeatureListFailed(item: Pick<FeatureListBoardItem, 'testConclusion' | 'acceptanceStatus'>): boolean {
    const text = `${item.testConclusion || ''} ${item.acceptanceStatus || ''}`.replace(/\s+/g, '').toLowerCase();
    return ['测试fail', 'fail', '失败', '验收不通过', '不通过'].some((key) => text.includes(key));
  }

  private isFeatureListExcluded(item: Pick<FeatureListBoardItem, 'testStatus' | 'testConclusion' | 'acceptanceStatus'>): boolean {
    const text = `${item.testStatus || ''} ${item.testConclusion || ''} ${item.acceptanceStatus || ''}`.replace(/\s+/g, '').toLowerCase();
    return ['不测', '废弃', '用例废弃'].some((key) => text.includes(key));
  }

  private averagePercent(values: number[]): number {
    const valid = values.filter((value) => Number.isFinite(value));
    if (valid.length === 0) return 0;
    return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
  }

  private buildFeatureListDomainStats(items: FeatureListBoardItem[]): FeatureListBoardResponse['domains'] {
    const groups = new Map<string, FeatureListBoardItem[]>();
    items.forEach((item) => groups.set(item.domain || '未分组', [...(groups.get(item.domain || '未分组') || []), item]));
    return Array.from(groups.entries()).map(([name, rows]) => {
      const accepted = rows.filter((item) => item.isClosed).length;
      const failed = rows.filter((item) => this.isFeatureListFailed(item)).length;
      const pending = Math.max(0, rows.length - accepted);
      const averagePassRate = this.averagePercent(rows.map((item) => item.passRate));
      const closureRate = rows.length > 0 ? Math.round((accepted / rows.length) * 100) : 0;
      const tone: 'good' | 'warn' | 'danger' = failed > 0 || averagePassRate < 70
        ? 'danger'
        : pending > 0 || averagePassRate < 90
          ? 'warn'
          : 'good';
      return {
        name,
        featureCount: rows.length,
        caseCount: rows.reduce((sum, item) => sum + item.caseCount, 0),
        averagePassRate,
        closureRate,
        failedCount: failed,
        pendingCount: pending,
        tone
      };
    }).sort((a, b) => (b.failedCount - a.failedCount) || (b.pendingCount - a.pendingCount) || (a.averagePassRate - b.averagePassRate));
  }

  private buildFeatureListDeveloperStats(items: FeatureListBoardItem[]): FeatureListBoardResponse['developers'] {
    const groups = new Map<string, FeatureListBoardItem[]>();
    items.forEach((item) => groups.set(item.developer || '未分配', [...(groups.get(item.developer || '未分配') || []), item]));
    return Array.from(groups.entries()).map(([name, rows]) => {
      const pending = rows.filter((item) => !item.isClosed).length;
      const averagePassRate = this.averagePercent(rows.map((item) => item.passRate));
      const tone: 'good' | 'warn' | 'danger' = averagePassRate < 70 ? 'danger' : pending > 0 || averagePassRate < 90 ? 'warn' : 'good';
      return {
        name,
        featureCount: rows.length,
        caseCount: rows.reduce((sum, item) => sum + item.caseCount, 0),
        averagePassRate,
        pendingCount: pending,
        tone
      };
    }).sort((a, b) => b.featureCount - a.featureCount).slice(0, 12);
  }

  private weeklyBugExpectedDate(bug: unknown): string {
    const expectedFixDate = (bug as { expectedFixDate?: string | null })?.expectedFixDate;
    return this.normalizeDateText(String(expectedFixDate || ''));
  }

  private calculateProjectWeeklyBugMetricValues(bugs: unknown[]): ProjectWeeklyBugMetricValues {
    const solvedKeys = ['无需修复', '验证通过', '不是问题'];
    const adjustedP0ExcludeKeys = ['无需修复', '转需求', '不是问题', '有依赖项', '重复问题', '重复'];

    const containsAny = (text: string, keys: string[]) => {
      const normalized = this.normalizeBugText(text);
      return keys.some((key) => normalized.includes(this.normalizeBugText(key)));
    };
    const isP0 = (bug: unknown) => {
      const text = this.bugSeverityText(bug);
      return this.normalizeBugText(text).includes('p0') || String((bug as { severity?: unknown })?.severity || '') === 'blocker';
    };
    const isP1 = (bug: unknown) => {
      const text = this.bugSeverityText(bug);
      return this.normalizeBugText(text).includes('p1') || String((bug as { severity?: unknown })?.severity || '') === 'critical';
    };
    const statusText = (bug: unknown) => this.bugPrimaryStatusText(bug);

    const solvedBugs = bugs.filter((bug) => containsAny(statusText(bug), solvedKeys));
    const pendingBugs = bugs.filter((bug) => !containsAny(statusText(bug), solvedKeys));
    const p0Bugs = bugs.filter(isP0);
    const adjustedP0Bugs = p0Bugs.filter((bug) => !containsAny(statusText(bug), adjustedP0ExcludeKeys));
    const pendingP0Bugs = this.filterProjectWeeklyPendingP0Bugs(bugs);

    return {
      totalIssues: bugs.length,
      solvedIssues: solvedBugs.length,
      pendingIssues: pendingBugs.length,
      totalP0Issues: p0Bugs.length,
      adjustedTotalP0Issues: adjustedP0Bugs.length,
      pendingP0Issues: pendingP0Bugs.length
    };
  }

  private async buildProjectWeeklyBugStats(projectId: number, bugs: unknown[], values: ProjectWeeklyBugMetricValues): Promise<ProjectWeeklyReportResponse['bugStats']> {
    const isP0 = (bug: unknown) => {
      const text = this.bugSeverityText(bug);
      return this.normalizeBugText(text).includes('p0') || String((bug as { severity?: unknown })?.severity || '') === 'blocker';
    };
    const isP1 = (bug: unknown) => {
      const text = this.bugSeverityText(bug);
      return this.normalizeBugText(text).includes('p1') || String((bug as { severity?: unknown })?.severity || '') === 'critical';
    };
    const today = this.projectWeeklySnapshotDate();
    const baseline = await this.ensureProjectWeeklyBugMetricSnapshot(projectId, today, values);
    const cardDelta = (key: ProjectWeeklyBugMetricKey) => values[key] - baseline[key];

    const pendingP0Bugs = this.filterProjectWeeklyPendingP0Bugs(bugs);
    const p0p1Bugs = bugs.filter((bug) => isP0(bug) || isP1(bug));
    const p0Bugs = bugs.filter(isP0);
    const p1Bugs = bugs.filter(isP1);
    const statusColorPalette = ['#3478f6', '#22c7b8', '#f4b400', '#f97316', '#d58be8', '#27a9e0', '#7cc9e8', '#3b8ebd', '#8b5cf6', '#16a34a'];
    const moduleCounts = new Map<string, number>();
    const buildStatusDistribution = (items: unknown[]) => {
      const total = items.length || 1;
      return this.countAll(items.map((bug) => this.bugDisplayStatusText(bug) || '未填写状态')).map((item, index) => ({
        name: item.name,
        value: item.value,
        percent: Math.round((item.value / total) * 1000) / 10,
        color: statusColorPalette[index % statusColorPalette.length]
      }));
    };

    pendingP0Bugs.forEach((bug) => {
      const modules = this.splitBugModules((bug as { technicalModules?: string | null })?.technicalModules || '');
      (modules.length > 0 ? modules : ['未填写']).forEach((name) => moduleCounts.set(name, (moduleCounts.get(name) || 0) + 1));
    });

    return {
      cards: [
        { label: '问题总数', value: values.totalIssues, explain: '缺陷表读取到的全量问题记录数。', delta: cardDelta('totalIssues'), baselineValue: baseline.totalIssues, baselineDate: today },
        { label: '已解决问题数', value: values.solvedIssues, explain: '问题状态包含「无需修复、验证通过、不是问题」的问题数。', delta: cardDelta('solvedIssues'), baselineValue: baseline.solvedIssues, baselineDate: today },
        { label: '待处理问题数', value: values.pendingIssues, explain: '问题状态不包含「无需修复、验证通过、不是问题」的问题数。', delta: cardDelta('pendingIssues'), baselineValue: baseline.pendingIssues, baselineDate: today },
        { label: '总P0问题数', value: values.totalP0Issues, explain: '严重等级包含 P0 的问题数。', delta: cardDelta('totalP0Issues'), baselineValue: baseline.totalP0Issues, baselineDate: today },
        { label: '调整后总P0问题数', value: values.adjustedTotalP0Issues, explain: '严重等级包含 P0，且问题状态不包含「无需修复、转需求、不是问题、有依赖项、重复问题」的问题数。', delta: cardDelta('adjustedTotalP0Issues'), baselineValue: baseline.adjustedTotalP0Issues, baselineDate: today },
        { label: '待处理P0问题数', value: values.pendingP0Issues, explain: '严重等级包含 P0，且问题状态包含「新建、修复中、待验证、验证失败、有依赖项、持续跟踪、依赖MB、依赖火山、待复现」的问题数。', delta: cardDelta('pendingP0Issues'), baselineValue: baseline.pendingP0Issues, baselineDate: today }
      ],
      p0p1StatusDistribution: buildStatusDistribution(p0p1Bugs),
      p0StatusDistribution: buildStatusDistribution(p0Bugs),
      p1StatusDistribution: buildStatusDistribution(p1Bugs),
      p0TechnicalModuleDistribution: Array.from(moduleCounts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    };
  }

  private projectWeeklySnapshotDate(date = new Date()) {
    return this.formatDateWithOffset(date, 8);
  }

  private snapshotToProjectWeeklyBugMetricValues(snapshot: ProjectWeeklyBugMetricValues): ProjectWeeklyBugMetricValues {
    return {
      totalIssues: snapshot.totalIssues || 0,
      solvedIssues: snapshot.solvedIssues || 0,
      pendingIssues: snapshot.pendingIssues || 0,
      totalP0Issues: snapshot.totalP0Issues || 0,
      adjustedTotalP0Issues: snapshot.adjustedTotalP0Issues || 0,
      pendingP0Issues: snapshot.pendingP0Issues || 0
    };
  }

  private async ensureProjectWeeklyBugMetricSnapshot(
    projectId: number,
    snapshotDate: string,
    values: ProjectWeeklyBugMetricValues
  ): Promise<ProjectWeeklyBugMetricValues> {
    try {
      const existing = await this.prisma.projectWeeklyBugMetricSnapshot.findUnique({
        where: { projectId_snapshotDate: { projectId, snapshotDate } }
      });
      if (existing) return this.snapshotToProjectWeeklyBugMetricValues(existing);

      const created = await this.prisma.projectWeeklyBugMetricSnapshot.create({
        data: {
          projectId,
          snapshotDate,
          totalIssues: values.totalIssues,
          solvedIssues: values.solvedIssues,
          pendingIssues: values.pendingIssues,
          totalP0Issues: values.totalP0Issues,
          adjustedTotalP0Issues: values.adjustedTotalP0Issues,
          pendingP0Issues: values.pendingP0Issues
        }
      });
      return this.snapshotToProjectWeeklyBugMetricValues(created);
    } catch (err: any) {
      this.logger.warn(`Weekly bug metric snapshot unavailable for project ${projectId}: ${err?.message || err}`);
      return values;
    }
  }

  @Cron('0 0 * * *', { timeZone: 'Asia/Shanghai' })
  async captureDailyProjectWeeklyBugMetricSnapshots() {
    const snapshotDate = this.projectWeeklySnapshotDate();
    const projects = await this.prisma.project.findMany({
      where: {
        weeklyDataSources: {
          some: {
            sourceType: 'bugs',
            appToken: { not: null },
            tableId: { not: null }
          }
        }
      },
      include: { weeklyDataSources: true }
    });

    for (const project of projects) {
      try {
        const source = await this.readProjectWeeklySource(project, 'bugs', '缺陷表');
        if (source.source !== 'feishu') {
          this.logger.warn(`Skip weekly bug metric snapshot for project ${project.id}: ${source.error || source.source}`);
          continue;
        }
        const bugs = source.items.map((record) => this.normalizeWeeklyBug(record.fields || {}));
        const values = this.calculateProjectWeeklyBugMetricValues(bugs);
        await this.prisma.projectWeeklyBugMetricSnapshot.upsert({
          where: { projectId_snapshotDate: { projectId: project.id, snapshotDate } },
          update: {
            capturedAt: new Date(),
            totalIssues: values.totalIssues,
            solvedIssues: values.solvedIssues,
            pendingIssues: values.pendingIssues,
            totalP0Issues: values.totalP0Issues,
            adjustedTotalP0Issues: values.adjustedTotalP0Issues,
            pendingP0Issues: values.pendingP0Issues
          },
          create: {
            projectId: project.id,
            snapshotDate,
            totalIssues: values.totalIssues,
            solvedIssues: values.solvedIssues,
            pendingIssues: values.pendingIssues,
            totalP0Issues: values.totalP0Issues,
            adjustedTotalP0Issues: values.adjustedTotalP0Issues,
            pendingP0Issues: values.pendingP0Issues
          }
        });
      } catch (err: any) {
        this.logger.warn(`Failed to capture weekly bug metric snapshot for project ${project.id}: ${err?.message || err}`);
      }
    }
  }

  private filterProjectWeeklyPendingP0P1Bugs(bugs: unknown[]): unknown[] {
    const pendingP0Keys = ['新建', '修复中', '待验证', '验证失败', '有依赖项', '持续跟踪', '依赖MB', '依赖火山', '待复现'];
    return bugs.filter((bug) => {
      const severityText = this.bugSeverityText(bug);
      const isP0 = this.normalizeBugText(severityText).includes('p0') || String((bug as { severity?: unknown })?.severity || '') === 'blocker';
      const isP1 = this.normalizeBugText(severityText).includes('p1') || String((bug as { severity?: unknown })?.severity || '') === 'critical';
      if (!isP0 && !isP1) return false;
      const statusText = this.bugPrimaryStatusText(bug);
      const normalizedStatus = this.normalizeBugText(statusText);
      return pendingP0Keys.some((key) => normalizedStatus.includes(this.normalizeBugText(key)));
    });
  }

  private filterProjectWeeklyPendingP0Bugs(bugs: unknown[]): unknown[] {
    return this.filterProjectWeeklyPendingP0P1Bugs(bugs).filter((bug) => {
      const severityText = this.bugSeverityText(bug);
      return this.normalizeBugText(severityText).includes('p0') || String((bug as { severity?: unknown })?.severity || '') === 'blocker';
    });
  }

  private buildProjectWeeklyPendingP0Bugs(bugs: unknown[]): ProjectWeeklyReportResponse['pendingP0Bugs'] {
    return this.filterProjectWeeklyPendingP0P1Bugs(bugs).map((bug) => {
      const item = bug as {
        id?: string | null;
        title?: string | null;
        technicalModules?: string | null;
        expectedFixDate?: string | null;
        primaryStatusText?: string | null;
        rawStatusText?: string | null;
        issueSource?: string | null;
        rootCause?: string | null;
        assigneeName?: string | null;
        rawSeverityText?: string | null;
        severity?: unknown;
      };
      const modules = this.splitBugModules(item.technicalModules || '');
      return {
        id: String(item.id || item.title || ''),
        title: String(item.title || '未命名缺陷'),
        technicalModules: modules.length > 0 ? modules : ['未填写'],
        expectedFixDate: String(item.expectedFixDate || ''),
        status: this.bugDisplayStatusText(item) || '未填写状态',
        source: String(item.issueSource || '未填写来源'),
        rootCause: String(item.rootCause || '未填写'),
        assignee: String(item.assigneeName || '未分配'),
        severity: String(item.rawSeverityText || item.severity || 'P0')
      };
    });
  }

  private normalizeBugText(value: string): string {
    return String(value || '').replace(/\s+/g, '').toLowerCase();
  }

  private bugStatusText(bug: unknown): string {
    const item = bug as { rawStatusText?: string | null; fixStatus?: string | null; status?: unknown };
    return [item.rawStatusText, item.fixStatus, item.status].filter(Boolean).join(' ');
  }

  private bugPrimaryStatusText(bug: unknown): string {
    const item = bug as { primaryStatusText?: string | null; rawStatusText?: string | null; fixStatus?: string | null; status?: unknown };
    return String(item.primaryStatusText || item.rawStatusText || item.fixStatus || item.status || '').trim();
  }

  private bugDisplayStatusText(bug: unknown): string {
    const item = bug as { primaryStatusText?: string | null; rawStatusText?: string | null; fixStatus?: string | null };
    return String(item.primaryStatusText || item.rawStatusText || item.fixStatus || '').trim();
  }

  private bugSeverityText(bug: unknown): string {
    const item = bug as { rawSeverityText?: string | null; severity?: unknown };
    return String(item.rawSeverityText || item.severity || '').trim();
  }

  private splitBugModules(value: string): string[] {
    return String(value || '')
      .split(/[、,，/／;；|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private resolveP0ClearTargetDate(
    milestones: Array<{ milestoneType?: string | null; plannedDate?: string | null }>,
    baseDate: string
  ): string {
    const candidates = milestones
      .map((item) => {
        const milestoneType = String(item.milestoneType || '');
        const text = this.normalizeBugText(milestoneType);
        const plannedDate = this.normalizeDateText(String(item.plannedDate || ''));
        return { text, plannedDate };
      })
      .filter((item) => item.plannedDate && item.plannedDate >= baseDate)
      .filter((item) => item.text === this.normalizeBugText('最终锁板'))
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));

    return candidates[0]?.plannedDate || '';
  }

  private projectWeeklyP0TargetValue(p0Start: number, startDate: string, currentDate: string, targetDate: string): number {
    if (!targetDate || !startDate || !currentDate) return p0Start;
    const start = Date.parse(`${startDate}T00:00:00.000Z`);
    const current = Date.parse(`${currentDate}T00:00:00.000Z`);
    const target = Date.parse(`${targetDate}T00:00:00.000Z`);
    if (!Number.isFinite(start) || !Number.isFinite(current) || !Number.isFinite(target)) return p0Start;
    if (target <= start) return current >= target ? 0 : p0Start;

    const progress = Math.max(0, Math.min(1, (current - start) / (target - start)));
    return Math.max(0, Math.round(p0Start * (1 - progress)));
  }

  private isWeeklyBugVerified(bug: { rawStatusText?: string | null; fixStatus?: string | null; status: BugStatus }): boolean {
    const text = `${bug.rawStatusText || ''} ${bug.fixStatus || ''} ${bug.status || ''}`.replace(/\s+/g, '').toLowerCase();
    return ['验收通过', '验证通过', '已验证'].some((key) => text.includes(key));
  }

  private isDevelopmentRiskBug(bug: unknown): boolean {
    const issueType = String((bug as { issueType?: string | null })?.issueType || '').replace(/\s+/g, '').toLowerCase();
    if (!issueType) return false;
    return issueType.includes('模型能力类')
      || issueType.includes('依赖mb协助')
      || (issueType.includes('模型') && issueType.includes('能力'))
      || (issueType.includes('mb') && issueType.includes('协助'));
  }

  private normalizeWeeklyBugStatus(value: string): BugStatus {
    const text = value.replace(/\s+/g, '').toLowerCase();
    if (['验证失败', '需关注', '待验证', '修复中', '未开始'].some((key) => text.includes(key))) return BugStatus.open;
    if ([
      '已关闭',
      '关闭',
      'closed',
      'done',
      '已解决',
      'resolved',
      '已验证',
      '验收通过',
      '验证通过',
      '无需修复',
      '不是问题',
      '非问题',
      '转需求',
      '重复问题',
      '重复',
      '已驳回',
      '驳回'
    ].some((key) => text.includes(key))) return BugStatus.closed;
    return BugStatus.open;
  }

  private normalizeWeeklyBugSeverity(value: string): string {
    const text = value.replace(/\s+/g, '').toLowerCase();
    if (['p0', 'blocker', '阻塞', '致命'].some((key) => text.includes(key))) return 'blocker';
    if (['p1', 'critical', '严重', '高'].some((key) => text.includes(key))) return 'critical';
    if (['p2', 'major', '中'].some((key) => text.includes(key))) return 'major';
    return 'minor';
  }

  private normalizeWeeklyTestSummary(fields: Record<string, unknown>) {
    const cases = this.numberField(fields, '计划用例数|用例数|测试用例数');
    const executed = this.numberField(fields, '已执行数|执行数|已执行用例数');
    const passed = this.numberField(fields, '通过数|通过用例数');
    const failed = this.numberField(fields, '失败数|失败用例数');
    const blocked = this.numberField(fields, '阻塞数|阻塞用例数');
    const skipped = this.numberField(fields, '跳过数|跳过用例数');
    return {
      round: this.fieldValue(fields, '测试轮次|轮次'),
      module: this.fieldValue(fields, '模块|测试模块') || '项目测试概况',
      cases,
      executed: executed || passed + failed + blocked + skipped,
      passed,
      failed,
      blocked,
      skipped,
      owner: this.fieldValue(fields, '测试负责人|负责人'),
      conclusion: this.fieldValue(fields, '测试结论|结论') || this.fieldValue(fields, '主要问题说明|问题说明')
    };
  }

  private normalizeWeeklyResource(fields: Record<string, unknown>) {
    const allocationPercent = this.numberField(fields, '投入比例|分配比例|占用比例') || 100;
    const allocationDays = this.numberField(fields, '投入人天|人天|投入天数');
    const startDate = this.normalizeDateText(this.fieldValue(fields, '开始日期|开始时间')) || '';
    const endDate = this.normalizeDateText(this.fieldValue(fields, '结束日期|结束时间')) || '';
    const status = this.fieldValue(fields, '资源状态|状态');
    const confirmStatus = this.fieldValue(fields, '分配确认状态|确认状态');
    const riskText = `${status} ${confirmStatus}`;
    return {
      personId: this.fieldValue(fields, '人员ID|人员编号|ID'),
      name: this.fieldValue(fields, '姓名|人员|成员') || this.fieldValue(fields, '人员ID|人员编号|ID'),
      projectId: '',
      projectName: '',
      role: this.fieldValue(fields, '角色|岗位'),
      department: this.fieldValue(fields, '部门'),
      startDate,
      endDate,
      allocationPercent,
      allocationDays,
      conflict: /紧张|过载|冲突|待确认|拒绝|需协调|请假|离岗/.test(riskText)
    };
  }

  private normalizeWeeklyMilestone(fields: Record<string, unknown>) {
    const plannedDate = this.normalizeDateText(this.fieldValue(fields, '计划交付日期|计划日期|计划完成时间|截止时间')) || '';
    const actualDate = this.normalizeDateText(this.fieldValue(fields, '实际完成日期|完成日期|实际完成时间')) || '';
    return {
      name: this.fieldValue(fields, '里程碑名称|名称|交付项|节点') || '未命名里程碑',
      milestoneType: this.fieldValue(fields, '里程碑类型|节点类型|类型'),
      plannedDate,
      actualDate,
      status: this.fieldValue(fields, '交付状态|状态'),
      owner: this.fieldValue(fields, '负责人|责任人'),
      riskLevel: this.fieldValue(fields, '风险等级|风险'),
      keyRisk: this.fieldValue(fields, '关键风险|风险说明'),
      nextAction: this.fieldValue(fields, '下一步动作|动作')
    };
  }

  private numberField(fields: Record<string, unknown>, desiredHeader: string) {
    const text = this.fieldValue(fields, desiredHeader).replace(/,/g, '').trim();
    const match = text.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  private parseWeeklyDate(value: string): Date | null {
    const normalized = this.normalizeDateText(value);
    if (!normalized) return null;
    const date = new Date(`${normalized}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseBugIdTimestamp(value: string): Date | null {
    const text = String(value || '');
    const timestampMatch = text.match(/\b(1[6-9]\d{11})\b/);
    if (timestampMatch) {
      const parsed = new Date(Number(timestampMatch[1]));
      if (!Number.isNaN(parsed.getTime())) {
        return this.parseWeeklyDate(this.formatDateWithOffset(parsed, 8));
      }
    }

    const secondTimestampMatch = text.match(/\b(1[6-9]\d{8})\b/);
    if (secondTimestampMatch) {
      const parsed = new Date(Number(secondTimestampMatch[1]) * 1000);
      if (!Number.isNaN(parsed.getTime())) {
        return this.parseWeeklyDate(this.formatDateWithOffset(parsed, 8));
      }
    }

    const compactDateTimeMatch = text.match(/\b(20\d{2})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?\b/);
    if (compactDateTimeMatch) {
      const [, year, month, day] = compactDateTimeMatch;
      return this.parseWeeklyDate(`${year}-${month}-${day}`);
    }

    return null;
  }

  private normalizeWeeklyFeishuTask(fields: Record<string, unknown>, project: { name: string }) {
    const status = this.fieldValue(fields, '状态|status');
    const blockedText = this.fieldValue(fields, '是否阻塞|阻塞|blocked');
    return {
      title: this.fieldValue(fields, '任务名称|事项|标题|名称|title') || '未命名事项',
      status,
      assignee: this.fieldValue(fields, '负责人|责任人|assignee|owner'),
      priority: this.fieldValue(fields, '优先级|priority'),
      riskLevel: this.fieldValue(fields, '风险等级|riskLevel|risk'),
      blocked: blockedText.includes('是') || blockedText.toLowerCase() === 'true',
      blockedReason: this.fieldValue(fields, '阻塞原因|风险原因|blockReason'),
      dueDate: this.normalizeDateText(this.fieldValue(fields, '截止时间|截止日期|承诺时间|dueDate')) || this.fieldValue(fields, '截止时间|截止日期|承诺时间|dueDate'),
      completedAt: this.normalizeDateText(this.fieldValue(fields, '完成时间|完成日期|completedAt')),
      action: this.fieldValue(fields, '下一步动作|动作|nextAction'),
      actionDueDate: this.normalizeDateText(this.fieldValue(fields, '动作截止时间|actionDueDate')),
      projectName: project.name
    };
  }

  private findClusterItemForProject(items: ClusterRiskBoardItem[], project: { id: number; name: string; alias?: string | null }) {
    return items.find((item) => this.matchesProjectIdentity(item.projectId, item.projectName, project))
      || items.find((item) => this.normalizeProjectName(item.projectName) === this.normalizeProjectName(project.name));
  }

  private matchesProjectIdentity(projectIdValue: string | number | null | undefined, projectNameValue: string | null | undefined, project: { id: number; name: string; alias?: string | null }) {
    const projectIdText = String(projectIdValue ?? '').trim();
    if (projectIdText && projectIdText === String(project.id)) return true;
    const normalizedName = this.normalizeProjectName(projectNameValue || '');
    if (!normalizedName) return false;
    return normalizedName === this.normalizeProjectName(project.name)
      || Boolean(project.alias && normalizedName === this.normalizeProjectName(project.alias));
  }

  private normalizeProjectName(value: string) {
    return String(value || '').replace(/\s+/g, '').trim().toLowerCase();
  }

  private isWeeklyTaskDone(status: string) {
    const text = String(status || '').replace(/\s+/g, '').toLowerCase();
    return ['done', 'closed', 'completed', '已完成', '完成', '已关闭', '关闭'].some((key) => text.includes(key));
  }

  private isWeeklyTaskOverdue(item: { dueDate?: string; completedAt?: string; status: string }, weekEnd: string) {
    if (!item.dueDate || item.dueDate > weekEnd) return false;
    return !this.isWeeklyTaskDone(item.status) && !item.completedAt;
  }

  private dateOnly(value?: Date | null) {
    return value ? this.formatDateUtc(value) : '';
  }

  private dateInPeriod(value: string, start: string, end: string) {
    return Boolean(value && value >= start && value <= end);
  }

  private weeklyHealthRow(dimension: string, metric: string, percent: number, trend: string, judgement: string, tone: 'good' | 'warn' | 'danger', action: string): ProjectWeeklyHealthRow {
    return { dimension, metric, percent: Math.max(0, Math.min(100, Math.round(percent || 0))), trend, judgement, tone, action };
  }

  private deliveryHealthPercent(milestones: Array<{ plannedDate: string; actualDate?: string | null }>) {
    if (milestones.length === 0) return 70;
    const done = milestones.filter((item) => Boolean(item.actualDate)).length;
    return Math.round((done / milestones.length) * 100);
  }

  private overdueMilestoneCount(milestones: Array<{ plannedDate: string; actualDate?: string | null }>) {
    const today = this.formatDateUtc(new Date());
    return milestones.filter((item) => !item.actualDate && item.plannedDate && item.plannedDate < today).length;
  }

  private keyDemoText(value: boolean | null | undefined) {
    if (value === true) return '近期重点演示';
    if (value === false) return '非近期演示';
    return '演示状态待确认';
  }

  private summarizeTaskProgress(tasks: Array<{ status: string; title: string }>) {
    if (tasks.length === 0) return '暂无本周进展数据。';
    const done = tasks.filter((item) => this.isWeeklyTaskDone(item.status)).slice(0, 4).map((item) => item.title);
    return done.length > 0 ? `本周已完成：${done.join('、')}。` : '当前任务仍在推进中，暂无完成项。';
  }

  private buildProjectWeeklyMilestones(
    milestones: Array<{ name: string; plannedDate: string; actualDate?: string | null; status?: string | null; owner?: string | null }>,
    clusterItem: ClusterRiskBoardItem | undefined,
    weekEnd: string
  ) {
    const rows = milestones
      .sort((a, b) => String(a.plannedDate || '').localeCompare(String(b.plannedDate || '')))
      .map((item) => {
        const done = Boolean(item.actualDate);
        const overdue = !done && item.plannedDate && item.plannedDate < weekEnd;
        return {
          name: item.name,
          due: item.plannedDate || '-',
          status: item.status || (done ? '已完成' : overdue ? '存在延期风险' : '进行中'),
          tone: done ? 'good' as const : overdue ? 'danger' as const : 'warn' as const,
          owner: item.owner || clusterItem?.pm || clusterItem?.ownerPm || 'PM'
        };
      });
    if (rows.length > 0) return rows;
    return [{
      name: clusterItem?.hasKeyDemo ? '近期重点演示' : '项目周度交付',
      due: clusterItem?.actionDueDate || '-',
      status: clusterItem?.hasKeyDemo ? '待演示确认' : '待补充里程碑',
      tone: 'warn' as const,
      owner: clusterItem?.pm || clusterItem?.ownerPm || 'PM'
    }];
  }

  private buildProjectWeeklyRisks(
    clusterItem: ClusterRiskBoardItem | undefined,
    seriousBugs: Array<{ title: string; assigneeName?: string | null }>,
    blockedTestItems: Array<{ testCase?: { title: string } | null }>
  ) {
    const risks: ProjectWeeklyReportResponse['risks'] = [];
    if (clusterItem?.dailyRiskHelp) {
      risks.push({
        title: 'Daily 风险求助',
        impact: clusterItem.dailyRiskHelp,
        owner: clusterItem.pm || clusterItem.ownerPm || 'PM',
        due: clusterItem.actionDueDate || '-',
        status: clusterItem.riskResolution || '待闭环',
        tone: clusterItem.riskLight === '红灯' ? 'danger' : 'warn',
        support: clusterItem.needsEscalation || '否'
      });
    }
    if (clusterItem?.urgentStaffingGap) {
      risks.push({
        title: '最紧急缺人情况',
        impact: clusterItem.urgentStaffingGap,
        owner: clusterItem.pm || clusterItem.ownerPm || 'PM',
        due: clusterItem.actionDueDate || '-',
        status: '协调中',
        tone: 'warn',
        support: clusterItem.needsEscalation || '否'
      });
    }
    seriousBugs.slice(0, 3).forEach((bug) => {
      risks.push({
        title: bug.title,
        impact: '严重缺陷未关闭，影响质量与验收信心',
        owner: bug.assigneeName || '未分配',
        due: '-',
        status: '处理中',
        tone: 'danger',
        support: '否'
      });
    });
    if (blockedTestItems.length > 0) {
      risks.push({
        title: '测试阻塞用例',
        impact: `${blockedTestItems.length} 个测试用例阻塞，影响测试通过率判断`,
        owner: '测试负责人',
        due: '-',
        status: '待确认',
        tone: 'warn',
        support: '否'
      });
    }
    return risks.slice(0, 8);
  }

  private buildProjectWeeklyTests(
    testCases: Array<{ title: string; status: string }>,
    testPlans: Array<{ title: string }>,
    testPlanItems: Array<{ result?: string | null; testCase?: { title: string } | null }>,
    failedCount: number,
    blockedCount: number
  ) {
    const executed = testPlanItems.filter((item) => Boolean(item.result)).length;
    const passed = testPlanItems.filter((item) => item.result === 'passed').length;
    const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;
    const tone: 'good' | 'warn' | 'danger' = blockedCount > 0 || passRate < 70 ? 'danger' : passRate < 85 ? 'warn' : 'good';
    return [{
      module: testPlans[0]?.title || '项目测试执行',
      cases: testCases.length,
      executed,
      passRate,
      failedBlocked: `${failedCount} / ${blockedCount}`,
      tone,
      conclusion: tone === 'danger' ? '高风险' : tone === 'warn' ? '关注' : '可控'
    }];
  }

  private buildProjectWeeklyTestsFromSummaries(
    summaries: Array<{ round: string; module: string; cases: number; executed: number; passed: number; failed: number; blocked: number; skipped: number; conclusion: string }>
  ) {
    if (summaries.length === 0) return [];
    return summaries.slice(0, 8).map((item) => {
      const passRate = item.executed > 0 ? Math.round((item.passed / item.executed) * 100) : 0;
      const tone: 'good' | 'warn' | 'danger' = item.blocked > 0 || passRate < 70 ? 'danger' : passRate < 85 ? 'warn' : 'good';
      return {
        module: item.module || item.round || '项目测试概况',
        cases: item.cases,
        executed: item.executed,
        passRate,
        failedBlocked: `${item.failed} / ${item.blocked}`,
        tone,
        conclusion: item.conclusion || (tone === 'danger' ? '高风险' : tone === 'warn' ? '关注' : '可控')
      };
    });
  }

  private buildProjectWeeklyRanks(
    bugs: Array<{ assigneeName?: string | null; status: BugStatus }>,
    overdueBugs: Array<{ assigneeName?: string | null }>,
    seriousBugs: Array<{ assigneeName?: string | null }>,
    resourceConflicts: Array<{ name: string }>
  ) {
    const openBugStatuses: BugStatus[] = [BugStatus.open, BugStatus.in_progress];
    const bugRank = this.countRank(bugs.filter((item) => openBugStatuses.includes(item.status)).map((item) => item.assigneeName || '未分配'));
    const delayRank = this.countRank(overdueBugs.map((item) => item.assigneeName || '未分配'));
    const seriousBugRank = this.countRank(seriousBugs.map((item) => item.assigneeName || '未分配'));
    const resourceRank = this.countRank(resourceConflicts.map((item) => item.name || '未分配'));
    return [
      { title: '待闭环动作排行', items: bugRank },
      { title: '未关闭缺陷排行', items: bugRank },
      { title: '延期缺陷排行', items: delayRank },
      { title: '严重缺陷排行', items: seriousBugRank },
      { title: '资源冲突排行', items: resourceRank }
    ];
  }

  private countRank(values: string[]) {
    const map = new Map<string, number>();
    values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) || 0) + 1));
    const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, value]) => ({ name, value }));
    return rows.length > 0 ? rows : [{ name: '暂无', value: 0 }];
  }

  private countAll(values: string[]) {
    const map = new Map<string, number>();
    values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) || 0) + 1));
    const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, value]) => ({ name, value }));
    return rows.length > 0 ? rows : [{ name: '暂无', value: 0 }];
  }

  private buildProjectWeeklyTrends(
    weekStart: string,
    weekEnd: string,
    bugs: Array<{
      createdAt: Date;
      closedAt?: Date | null;
      resolvedAt?: Date | null;
      verifiedAt?: Date | null;
      severity?: string | null;
      expectedFixDate?: string | null;
      rawStatusText?: string | null;
      primaryStatusText?: string | null;
      fixStatus?: string | null;
      status: BugStatus;
      issueType?: string | null;
      technicalModules?: string | null;
    }>,
    milestones: Array<{ milestoneType?: string | null; plannedDate?: string | null }> = []
  ) {
    const days = this.daysBetween(weekStart, weekEnd).slice(0, 7);
    const expectedOn = (bug: { expectedFixDate?: string | null }, day: string) => this.weeklyBugExpectedDate(bug) === day;
    const verifiedOn = (bug: { expectedFixDate?: string | null; verifiedAt?: Date | null; rawStatusText?: string | null; fixStatus?: string | null; status: BugStatus }, day: string) => {
      if (!this.isWeeklyBugVerified(bug)) return false;
      return this.dateOnly(bug.verifiedAt) === day || (!bug.verifiedAt && expectedOn(bug, day));
    };
    const closeDate = (bug: {
      closedAt?: Date | null;
      resolvedAt?: Date | null;
      verifiedAt?: Date | null;
      expectedFixDate?: string | null;
      rawStatusText?: string | null;
      fixStatus?: string | null;
      status: BugStatus;
    }) => {
      const explicitCloseDate = this.dateOnly(bug.closedAt || bug.resolvedAt || bug.verifiedAt || null);
      if (explicitCloseDate) return explicitCloseDate;
      if (this.isWeeklyBugVerified(bug)) return this.weeklyBugExpectedDate(bug);
      return '';
    };
    const closedOn = (bug: { closedAt?: Date | null; resolvedAt?: Date | null; verifiedAt?: Date | null; expectedFixDate?: string | null; rawStatusText?: string | null; fixStatus?: string | null; status: BugStatus }, day: string) => {
      if (!this.isWeeklyBugVerified(bug) && bug.status !== BugStatus.closed) return false;
      return closeDate(bug) === day;
    };
    const createdOnOrBefore = (bug: { createdAt: Date }, day: string) => {
      const created = this.dateOnly(bug.createdAt);
      return Boolean(created && created <= day);
    };
    const closedOnOrBefore = (bug: { closedAt?: Date | null; resolvedAt?: Date | null; verifiedAt?: Date | null; expectedFixDate?: string | null; rawStatusText?: string | null; fixStatus?: string | null; status: BugStatus }, day: string) => {
      const closed = closeDate(bug);
      return Boolean(closed && closed <= day && (this.isWeeklyBugVerified(bug) || bug.status === BugStatus.closed));
    };
    const activeOnDay = (bug: {
      createdAt: Date;
      closedAt?: Date | null;
      resolvedAt?: Date | null;
      verifiedAt?: Date | null;
      expectedFixDate?: string | null;
      rawStatusText?: string | null;
      fixStatus?: string | null;
      status: BugStatus;
    }, day: string) => createdOnOrBefore(bug, day) && !closedOnOrBefore(bug, day);
    const expectedBefore = (bug: { expectedFixDate?: string | null }, day: string) => {
      const expected = this.weeklyBugExpectedDate(bug);
      return Boolean(expected && expected < day);
    };
    const isP0 = (bug: { severity?: string | null; rawSeverityText?: string | null }) => {
      const text = this.bugSeverityText(bug);
      return this.normalizeBugText(text).includes('p0') || bug.severity === 'blocker';
    };
    const isP1 = (bug: { severity?: string | null; rawSeverityText?: string | null }) => {
      const text = this.bugSeverityText(bug);
      return this.normalizeBugText(text).includes('p1') || bug.severity === 'critical';
    };
    const adjustedExcludeKeys = ['无需修复', '转需求', '不是问题', '有依赖项', '重复问题', '重复'];
    const isAdjustedRemaining = (bug: { primaryStatusText?: string | null; rawStatusText?: string | null; fixStatus?: string | null; status: BugStatus }) => {
      const statusText = this.bugPrimaryStatusText(bug);
      const normalizedStatus = this.normalizeBugText(statusText);
      return !adjustedExcludeKeys.some((key) => normalizedStatus.includes(this.normalizeBugText(key)));
    };
    const moduleColorPalette = ['#3177f6', '#e5484d', '#7257d6', '#e29a00', '#0ea5b7', '#16a36a', '#f97316', '#8b5cf6', '#0891b2', '#64748b', '#db2777', '#84cc16'];
    const normalizeTechnicalModuleName = (value: string) => {
      const text = value.trim();
      if (this.normalizeBugText(text) === this.normalizeBugText('导航')) return '导航专项';
      return text || '未填写';
    };
    const primaryModuleOf = (bug: { technicalModules?: string | null }) => {
      const modules = this.splitBugModules(String(bug.technicalModules || '')).map((item) => normalizeTechnicalModuleName(item)).filter(Boolean);
      return modules[0] || '未填写';
    };
    const buildModuleTrendSeries = (scope: (bug: { technicalModules?: string | null; severity?: string | null; rawSeverityText?: string | null }) => boolean) => {
      const scopedBugs = bugs.filter(scope);
      const moduleTotals = new Map<string, number>();
      scopedBugs.forEach((bug) => {
        const moduleName = primaryModuleOf(bug);
        moduleTotals.set(moduleName, (moduleTotals.get(moduleName) || 0) + 1);
      });
      const moduleNames = Array.from(moduleTotals.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name]) => name);
      return moduleNames.map((moduleName, index) => ({
        name: moduleName,
        color: moduleColorPalette[index % moduleColorPalette.length],
        values: days.map((day) => scopedBugs.filter((bug) => createdOnOrBefore(bug, day) && primaryModuleOf(bug) === moduleName).length)
      }));
    };
    const allModuleSeries = buildModuleTrendSeries((bug) => isP0(bug) || isP1(bug));
    const p0ModuleSeries = buildModuleTrendSeries((bug) => isP0(bug));
    const p1ModuleSeries = buildModuleTrendSeries((bug) => isP1(bug));
    const newValues = days.map((day) => bugs.filter((bug) => this.dateOnly(bug.createdAt) === day).length);
    const closedValues = days.map((day) => bugs.filter((bug) => closedOn(bug, day)).length);
    const netValues = days.map((_, index) => newValues[index] - closedValues[index]);
    const lastThreeNew = newValues.slice(-3).reduce((sum, value) => sum + value, 0);
    const lastThreeClosed = closedValues.slice(-3).reduce((sum, value) => sum + value, 0);
    const netConclusionTone: 'good' | 'warn' | 'danger' = lastThreeClosed >= lastThreeNew ? 'good' : lastThreeClosed >= lastThreeNew * 0.8 ? 'warn' : 'danger';
    const netConclusion = netConclusionTone === 'good'
      ? '当前判断：最近 3 天关闭量已覆盖新增量，缺陷开始收敛'
      : netConclusionTone === 'warn'
        ? '当前判断：新增与关闭接近，仍需持续观察'
        : '当前判断：最近 3 天新增缺陷高于关闭缺陷，仍处扩散状态';
    const p0TargetDate = this.resolveP0ClearTargetDate(milestones, days[0]);
    const p0Values = days.map((day) => bugs.filter((bug) => isP0(bug) && createdOnOrBefore(bug, day) && isAdjustedRemaining(bug)).length);
    const p1Values = days.map((day) => bugs.filter((bug) => isP1(bug) && createdOnOrBefore(bug, day) && isAdjustedRemaining(bug)).length);
    const p0Start = p0Values[0] || 0;
    const p0TargetValues = days.map((day) => this.projectWeeklyP0TargetValue(p0Start, days[0], day, p0TargetDate));
    const p0TargetLabel = p0TargetDate ? `P0 目标线（${p0TargetDate.slice(5)}清零）` : 'P0 目标线';
    return [
      {
        id: 'net',
        label: '缺陷净增',
        title: '缺陷净增趋势',
        description: '每日新增、每日关闭和净增缺陷同图对比，判断问题是在收敛还是发散。',
        value: '价值：判断收敛/发散',
        unit: '条',
        chart: 'line' as const,
        conclusion: netConclusion,
        conclusionTone: netConclusionTone,
        days: days.map((day) => day.slice(5)),
        series: [
          { name: '每日新增缺陷', color: '#e5484d', values: newValues },
          { name: '每日关闭缺陷', color: '#16a36a', values: closedValues },
          { name: '净增缺陷', color: '#e29a00', values: netValues }
        ]
      },
      {
        id: 'p0p1',
        label: 'P0/P1 遗留',
        title: 'P0/P1 遗留趋势',
        description: '每天剩余 P0、P1 数量同图展示，并叠加 P0 目标线，观察高优问题是否下降。',
        value: '价值：管理层关注高优问题下降',
        unit: '条',
        chart: 'line' as const,
        conclusion: p0Values[p0Values.length - 1] < p0Start ? '当前判断：P0 存量下降，高优问题正在收敛' : '当前判断：P0 存量未下降，清零目标仍有压力',
        conclusionTone: p0Values[p0Values.length - 1] < p0Start ? 'good' as const : 'warn' as const,
        days: days.map((day) => day.slice(5)),
        series: [
          { name: '剩余 P0', color: '#e5484d', values: p0Values },
          { name: '剩余 P1', color: '#7257d6', values: p1Values },
          { name: p0TargetLabel, color: '#16a36a', dashed: true, values: p0TargetValues }
        ]
      },
      {
        id: 'completion',
        label: '任务完成率',
        title: '任务完成率趋势',
        description: '按天统计预计当天完成的缺陷中，验证通过占比；同时展示计划数和验证通过数。',
        value: '价值：看团队每天兑现计划的能力',
        unit: '',
        chart: 'line' as const,
        conclusion: '当前判断：对比计划处理数和验证通过数，识别每日计划兑现能力。',
        conclusionTone: 'warn' as const,
        days: days.map((day) => day.slice(5)),
        series: [
          { name: '计划处理数', color: '#3177f6', unit: '条', values: days.map((day) => bugs.filter((bug) => expectedOn(bug, day)).length) },
          { name: '验证通过数', color: '#16a36a', unit: '条', values: days.map((day) => bugs.filter((bug) => verifiedOn(bug, day)).length) },
          {
            name: '任务完成率',
            color: '#e29a00',
            unit: '%',
            values: days.map((day) => {
              const planned = bugs.filter((bug) => expectedOn(bug, day)).length;
              const verified = bugs.filter((bug) => verifiedOn(bug, day)).length;
              return planned > 0 ? Math.round((verified / planned) * 100) : 0;
            })
          }
        ]
      },
      {
        id: 'overdue',
        label: '延期缺陷',
        title: '延期缺陷趋势',
        description: '统计预计修复时间早于当天且仍未闭环的缺陷数量，并拆出其中 P0/P1。',
        value: '价值：识别交付节奏是否失控',
        unit: '条',
        chart: 'line' as const,
        conclusion: '当前判断：延期缺陷和高优延期同步上升时，需要管理层推动资源和依赖闭环。',
        conclusionTone: 'danger' as const,
        days: days.map((day) => day.slice(5)),
        series: [
          { name: '延期缺陷', color: '#e5484d', values: days.map((day) => bugs.filter((bug) => expectedBefore(bug, day) && activeOnDay(bug, day)).length) },
          { name: '延期 P0', color: '#b91c1c', values: days.map((day) => bugs.filter((bug) => isP0(bug) && expectedBefore(bug, day) && activeOnDay(bug, day)).length) },
          { name: '延期 P1', color: '#e29a00', values: days.map((day) => bugs.filter((bug) => isP1(bug) && expectedBefore(bug, day) && activeOnDay(bug, day)).length) }
        ]
      },
      {
        id: 'issueType',
        label: '技术模块分布',
        title: '技术模块分布趋势',
        description: '按缺陷表「技术模块」的第一项归属统计，确保每条缺陷只计入一个模块。',
        value: '价值：识别模块风险结构',
        unit: '条',
        chart: 'stacked' as const,
        conclusion: '当前判断：技术模块缺陷集中度偏高时，需要按专项拆解责任和闭环计划。',
        conclusionTone: 'warn' as const,
        days: days.map((day) => day.slice(5)),
        series: allModuleSeries,
        variants: [
          { key: 'all', label: '全部', series: allModuleSeries },
          { key: 'p0', label: 'P0', series: p0ModuleSeries },
          { key: 'p1', label: 'P1', series: p1ModuleSeries }
        ]
      }
    ];
  }

  private daysBetween(start: string, end: string) {
    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T00:00:00.000Z`);
    const result: string[] = [];
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return result;
    for (let time = startDate.getTime(); time <= endDate.getTime(); time += 86_400_000) {
      result.push(this.formatDateUtc(new Date(time)));
    }
    return result;
  }

  private buildProjectWeeklyAiSummary(
    projectName: string,
    metrics: ProjectWeeklyMetric[],
    risks: ProjectWeeklyReportResponse['risks'],
    taskCompletionRate: number,
    testPassRate: number,
    openBugCount: number,
    seriousBugCount: number
  ) {
    const health = metrics.find((item) => item.label === '项目健康度')?.value || '待确认';
    return {
      conclusion: `${projectName} 本周整体处于「${health}」状态：任务完成率 ${taskCompletionRate}%，测试通过率 ${testPassRate}%，打开缺陷 ${openBugCount} 个，严重缺陷 ${seriousBugCount} 个。当前重点是压缩风险闭环周期，并确保关键交付节点稳定。`,
      risks: risks.slice(0, 3).map((item) => `${item.title}：${item.impact}`),
      actions: risks.slice(0, 3).map((item) => `${item.owner || '责任人'} 在 ${item.due || '本周内'} 前推进「${item.title}」闭环。`),
      nextWeek: [
        '关闭延期/阻塞事项并同步责任人。',
        '完成严重缺陷修复计划和复测。',
        '补齐测试执行数据，稳定测试通过率。',
        '按交付范围收口下周演示或验收材料。'
      ]
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
      projectStage: get('projectStage'),
      deliveryStatus: get('deliveryStatus'),
      ownerOne,
      pm,
      ownerPm: legacyOwnerPm || [ownerOne, pm].filter(Boolean).join(' / '),
      riskLight: this.normalizeRiskLight(get('riskLight')),
      riskTrend: get('riskTrend'),
      riskCategory: get('riskCategory'),
      keyRiskSummary: get('keyRiskSummary'),
      riskImpact: get('riskImpact'),
      deliveryScope: get('deliveryScope'),
      hasKeyDemo: this.normalizeYesNo(get('keyDemo')),
      weeklyProgress: get('weeklyProgress'),
      dailyRiskHelp: get('dailyRiskHelp'),
      urgentStaffingGap: get('urgentStaffingGap'),
      riskResolution: get('riskResolution'),
      nextAction: get('nextAction'),
      actionOwner: get('actionOwner'),
      actionDueDate: this.normalizeDateText(get('actionDueDate')) || get('actionDueDate'),
      needsEscalation: get('needsEscalation'),
      escalationRequest: get('escalationRequest'),
      qualityGap: get('qualityGap'),
      qualityLevel,
      updatedAt: this.normalizeDateText(get('updatedAt')) || get('updatedAt'),
      updatedBy: get('updatedBy')
    };
  }

  private buildClusterUpdateFields(body: Record<string, unknown>, fieldMap: Record<string, string>, tableFields?: Set<string>, actorRole?: string) {
    const allowed: Array<[string, keyof Omit<ClusterRiskBoardItem, 'hasKeyDemo'>]> = [
      ['projectId', 'projectId'],
      ['ownerOne', 'ownerOne'],
      ['riskLight', 'riskLight'],
      ['weeklyProgress', 'weeklyProgress'],
      ['dailyRiskHelp', 'dailyRiskHelp'],
      ['urgentStaffingGap', 'urgentStaffingGap'],
      ['riskResolution', 'riskResolution'],
      ['deliveryScope', 'deliveryScope'],
      ['projectStage', 'projectStage'],
      ['deliveryStatus', 'deliveryStatus'],
      ['riskTrend', 'riskTrend'],
      ['riskCategory', 'riskCategory'],
      ['keyRiskSummary', 'keyRiskSummary'],
      ['riskImpact', 'riskImpact'],
      ['nextAction', 'nextAction'],
      ['actionOwner', 'actionOwner'],
      ['actionDueDate', 'actionDueDate'],
      ['needsEscalation', 'needsEscalation'],
      ['escalationRequest', 'escalationRequest'],
      ['qualityGap', 'qualityGap'],
      ['qualityLevel', 'qualityLevel'],
      ['updatedAt', 'updatedAt'],
      ['updatedBy', 'updatedBy']
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
      ['pm', 'pm'],
      ['urgentStaffingGap', 'urgentStaffingGap']
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
    const plannedDeliveryDate = this.normalizeDateText(get('plannedDeliveryDate')) || get('plannedDeliveryDate');
    const targetDate = this.normalizeDateText(get('targetDate')) || plannedDeliveryDate;
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
      vehicleVersionName: get('vehicleVersionName'),
      milestoneType: get('milestoneType'),
      plannedDeliveryDate,
      committedDeliveryDate: this.normalizeDateText(get('committedDeliveryDate')) || get('committedDeliveryDate'),
      actualDeliveryDate: this.normalizeDateText(get('actualDeliveryDate')) || get('actualDeliveryDate'),
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
    const keys: Array<keyof typeof DELIVERY_ROADMAP_FIELD_MAP> = ['categoryL1', 'categoryL2', 'ySortOrder', 'targetDate', 'plannedDeliveryDate', 'targetQuarter', 'milestoneName', 'vehicleVersionName'];
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
      skillTags: get('skillTags'),
      level: get('level'),
      location: get('location'),
      dailyCapacity: this.normalizePositiveNumber(get('dailyCapacity'), 1),
      status: get('personStatus') || '在职',
      isKeyResource: get('isKeyResource'),
      resourceStatus: get('resourceStatus'),
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
      allocationConfirmStatus: get('allocationConfirmStatus'),
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
        skillTags: '',
        level: '',
        location: '',
        dailyCapacity: 1,
        status: '从分配表推断',
        isKeyResource: '',
        resourceStatus: '',
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

  private overlapDayCount(startDate: string, endDate: string, rangeStart: string, rangeEnd: string): number {
    if (!startDate || !rangeStart || !rangeEnd) return 0;
    const start = new Date(`${startDate}T00:00:00+08:00`).getTime();
    const end = new Date(`${(endDate || startDate)}T00:00:00+08:00`).getTime();
    const targetStart = new Date(`${rangeStart}T00:00:00+08:00`).getTime();
    const targetEnd = new Date(`${rangeEnd}T00:00:00+08:00`).getTime();
    if (![start, end, targetStart, targetEnd].every(Number.isFinite) || end < start || targetEnd < targetStart) return 0;
    const overlapStart = Math.max(start, targetStart);
    const overlapEnd = Math.min(end, targetEnd);
    if (overlapEnd < overlapStart) return 0;
    return Math.floor((overlapEnd - overlapStart) / 86_400_000) + 1;
  }

  private weeklyAllocationDays(
    allocation: { startDate: string; endDate: string; allocationDays: number; allocationPercent: number },
    weekStart: string,
    weekEnd: string
  ): number {
    const overlapDays = this.overlapDayCount(allocation.startDate, allocation.endDate, weekStart, weekEnd);
    if (overlapDays <= 0) return 0;
    const totalDays = this.inclusiveDayCount(allocation.startDate, allocation.endDate);
    if (allocation.allocationDays > 0 && totalDays > 0) {
      return allocation.allocationDays * overlapDays / totalDays;
    }
    return overlapDays * allocation.allocationPercent / 100;
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

  private fieldValueByPriority(fields: Record<string, unknown>, desiredHeaders: string[]): string {
    for (const header of desiredHeaders) {
      const value = this.fieldValue(fields, header);
      if (value) return value;
    }
    return '';
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
    if (/^\d{1,2}[月/-]\d{1,2}日?$/.test(text)) {
      const [month, day] = text.replace('日', '').split(/[月/-]/).map(Number);
      return this.formatDateUtc(new Date(Date.UTC(new Date().getUTCFullYear(), month - 1, day)));
    }
    if (/^\d{4}$/.test(text)) {
      const month = Number(text.slice(0, 2));
      const day = Number(text.slice(2, 4));
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return this.formatDateUtc(new Date(Date.UTC(new Date().getUTCFullYear(), month - 1, day)));
      }
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
