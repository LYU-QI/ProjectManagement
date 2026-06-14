export type FeishuFormState = {
  任务ID: string;
  任务名称: string;
  任务类型: string;
  状态: string;
  优先级: string;
  负责人: string;
  协作人: string;
  开始时间: string;
  截止时间: string;
  承诺时间: string;
  完成时间: string;
  进度: string;
  所属项目: string;
  是否阻塞: string;
  阻塞原因: string;
  风险等级: string;
  风险原因: string;
  下一步动作: string;
  动作截止时间: string;
  '依赖/前置条件': string;
  里程碑: string;
  更新时间: string;
  更新人: string;
};

export interface DashboardOverview {
  summary: { projectCount: number; requirementCount: number; riskProjectCount: number };
  projects: Array<{
    projectId: number;
    projectName: string;
    healthScore: number;
    varianceRate: number;
    blockedTasks: number;
    requirementCount: number;
    actualCost: number;
    budget: number;
  }>;
}

export type ClusterRiskLight = '红灯' | '黄灯' | '绿灯' | '未填';

export interface ClusterRiskBoardItem {
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
}

export interface ClusterRiskBoardResponse {
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
}

export interface DeliveryRoadmapQuarter {
  key: string;
  year: number;
  quarter: number;
  label: string;
  start: string;
  end: string;
}

export interface DeliveryRoadmapItem {
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
}

export interface DeliveryRoadmapLane {
  id: string;
  categoryL1: string;
  categoryL2: string;
  ySortOrder: number;
  items: DeliveryRoadmapItem[];
}

export interface DeliveryRoadmapLegendItem {
  iconStyle: string;
  label: string;
  color: string;
}

export interface DeliveryRoadmapResponse {
  generatedAt: string;
  source: 'feishu' | 'config_missing' | 'error';
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
}

export type ResourceLoadStatus = 'idle' | 'normal' | 'saturated' | 'overloaded' | 'unavailable';

export interface ResourceCalendarPerson {
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
}

export interface ResourceCalendarAllocation {
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
}

export interface ResourceCalendarCell {
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
}

export interface ResourceCalendarConflict {
  type: 'overload' | 'multi_project' | 'unavailable';
  severity: 'high' | 'medium' | 'low';
  personId: string;
  name: string;
  date: string;
  message: string;
}

export interface ResourceCalendarResponse {
  generatedAt: string;
  source: 'feishu' | 'config_missing' | 'error';
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
  people: ResourceCalendarPerson[];
  allocations: ResourceCalendarAllocation[];
  availability: unknown[];
  cells: ResourceCalendarCell[];
  conflicts: ResourceCalendarConflict[];
}

export type ProjectWeeklyTone = 'good' | 'warn' | 'danger' | '';

export interface ProjectWeeklyMetric {
  label: string;
  value: string;
  sub: string;
  tone: ProjectWeeklyTone;
}

export interface ProjectWeeklyReportResponse {
  generatedAt: string;
  source: 'mixed' | 'local' | 'config_missing' | 'error';
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
  health: Array<{
    dimension: string;
    metric: string;
    percent: number;
    trend: string;
    judgement: string;
    tone: Exclude<ProjectWeeklyTone, ''>;
    action: string;
  }>;
  progress: {
    weeklyProgress: string;
    deliveryScope: string;
    keyDemo: string;
  };
  milestones: Array<{ name: string; due: string; status: string; tone: Exclude<ProjectWeeklyTone, ''>; owner: string }>;
  discussions: Array<{ index: string; topic: string; technicalPoint: string; owner: string; plannedDate: string; progress: string; solution: string; bugCount: number; tone: Exclude<ProjectWeeklyTone, ''> }>;
  risks: Array<{ title: string; impact: string; owner: string; due: string; status: string; tone: Exclude<ProjectWeeklyTone, ''>; support: string }>;
  qualityCards: ProjectWeeklyMetric[];
  tests: Array<{ module: string; cases: number; executed: number; passRate: number; failedBlocked: string; tone: Exclude<ProjectWeeklyTone, ''>; conclusion: string }>;
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
    conclusionTone: Exclude<ProjectWeeklyTone, ''>;
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
}

export interface Requirement {
  id: number;
  projectId: number;
  projectSeq?: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  changeCount: number;
  lastReviewDecision?: 'approved' | 'rejected' | null;
}

export interface RequirementChange {
  id: number;
  requirementId: number;
  changedBy?: string | null;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  version?: string | null;
  createdAt: string;
}

export interface CostSummary {
  projectId: number;
  budget: number;
  actual: number;
  varianceRate: number;
  byType: { labor: number; outsource: number; cloud: number };
}

export interface ScheduleData {
  tasks: Array<{ id: number; title: string; assignee: string; status: string; plannedStart: string; plannedEnd: string }>;
  milestones: Array<{ id: number; name: string; plannedDate: string; actualDate?: string | null }>;
}

export interface RiskData {
  projectId: number;
  blockedCount: number;
  inProgressCount: number;
  riskLevel: string;
}

export interface RiskAlertItem {
  recordId: string;
  taskId: string;
  taskName: string;
  status: string;
  priority: string;
  assignee: string;
  project: string;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  daysLeft: number | null;
  blocked: string;
  blockedReason: string;
  riskLevel: string;
  milestone: string;
  overdue: boolean;
}

export interface RiskAlertsResponse {
  generatedAt: string;
  thresholdDays: number;
  progressThreshold: number;
  rules: Array<{
    id: string;
    name: string;
    description: string;
    thresholdDays: number;
    progressThreshold: number;
  }>;
  count: number;
  items: RiskAlertItem[];
}

export interface FeishuDependency {
  id: number;
  projectName: string;
  taskRecordId: string;
  taskId?: string | null;
  dependsOnRecordId: string;
  dependsOnTaskId?: string | null;
  type: 'FS' | 'SS' | 'FF';
}

export interface PrdDocument {
  id: number;
  projectId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrdVersion {
  id: number;
  documentId: number;
  versionLabel?: string | null;
  fileName: string;
  createdAt: string;
}

export interface PrdDiffToken {
  type: 'added' | 'removed' | 'same';
  text: string;
}

export interface PrdDiffBlock {
  type: 'added' | 'removed' | 'same' | 'changed';
  text?: string;
  tokens?: PrdDiffToken[];
}

export interface PrdCompareResult {
  leftVersion: PrdVersion;
  rightVersion: PrdVersion;
  summary: string;
  counts: {
    added: number;
    removed: number;
    changed: number;
    same: number;
  };
  blocks: PrdDiffBlock[];
}

export interface ProjectItem {
  id: number;
  name: string;
  alias?: string | null;
  budget: number;
  startDate?: string | null;
  endDate?: string | null;
  feishuChatIds?: string | null;
  feishuAppToken?: string | null;
  feishuTableId?: string | null;
  feishuViewId?: string | null;
}

export type ProjectWeeklyDataSourceType = 'status_risk' | 'bugs' | 'tests' | 'resources' | 'milestones' | 'discussion_plans' | 'feature_list';

export interface ProjectWeeklyDataSource {
  sourceType: ProjectWeeklyDataSourceType;
  label: string;
  appToken?: string | null;
  tableId?: string | null;
  viewId?: string | null;
}

export interface ProjectWeeklyDataSourcesResponse {
  projectId: number;
  sources: ProjectWeeklyDataSource[];
}

export interface FeatureListDataSourceResponse {
  projectId: number;
  source: ProjectWeeklyDataSource & { sourceType: 'feature_list' };
}

export interface FeatureListBoardResponse {
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
  domains: Array<{ name: string; featureCount: number; caseCount: number; averagePassRate: number; closureRate: number; failedCount: number; pendingCount: number; tone: Exclude<ProjectWeeklyTone, ''> }>;
  riskDomains: Array<{ name: string; reason: string; action: string; tone: Exclude<ProjectWeeklyTone, ''> }>;
  developers: Array<{ name: string; featureCount: number; caseCount: number; averagePassRate: number; pendingCount: number; tone: Exclude<ProjectWeeklyTone, ''> }>;
  items: Array<{
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
    tone: Exclude<ProjectWeeklyTone, ''>;
  }>;
}

export interface CostEntryItem {
  id: number;
  projectId: number;
  type: 'labor' | 'outsource' | 'cloud';
  amount: number;
  occurredOn: string;
  note?: string | null;
}

export interface Worklog {
  id: number;
  projectId: number;
  userId?: number;
  assigneeName?: string;
  taskTitle?: string;
  weekStart?: string;
  weekEnd?: string;
  totalDays?: number;
  hours: number;
  hourlyRate: number;
  workedOn: string;
}

export interface NotificationItem {
  id: number;
  projectId?: number;
  level: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
}

export interface UserItem {
  id: number;
  name: string;
  role: 'super_admin' | 'project_manager' | 'dept_head' | 'pm' | 'member' | 'viewer';
  username: string;
}

export interface AuditLogItem {
  id: number;
  userName?: string;
  userRole?: string;
  method: string;
  path: string;
  source?: string;
  projectId?: number;
  organizationId?: string;
  outcome?: 'success' | 'failed';
  statusCode?: number;
  errorMessage?: string;
  resourceType?: string;
  resourceId?: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  createdAt: string;
}

export interface ChatbotAuditNode {
  step: string;
  at: string;
  [key: string]: unknown;
}

export interface ChatbotAuditItem {
  id: number;
  userName?: string;
  userRole?: string;
  projectId?: number;
  organizationId?: string;
  createdAt: string;
  outcome?: 'success' | 'failed';
  source?: string;
  statusCode?: number;
  errorMessage?: string;
  resourceType?: string;
  resourceId?: string;
  mode: string;
  message: string;
  resultContent: string;
  error?: string;
  detailScope?: string;
  scopedProjectNames: string[];
  trace: ChatbotAuditNode[];
  toolCalls: ChatbotAuditNode[];
}

export interface AuthUser {
  id: number;
  name: string;
  role: string;
}

export interface ProjectMembershipItem {
  id: number;
  userId: number;
  projectId: number;
  role: 'director' | 'manager' | 'member' | 'viewer';
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    name: string;
    role: string;
  };
  project: {
    id: number;
    name: string;
  };
}

export interface WorkItem {
  id: number;
  projectId?: number | null;
  title: string;
  description?: string | null;
  type: 'todo' | 'issue';
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';
  assigneeId?: number | null;
  assigneeName?: string | null;
  creatorId: number;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: number;
    name: string;
    alias?: string | null;
  } | null;
  creator?: {
    id: number;
    name: string;
    username?: string | null;
  };
  assignee?: {
    id: number;
    name: string;
    username?: string | null;
  } | null;
}

export interface WorkItemHistory {
  id: number;
  workItemId: number;
  field: 'status' | 'assignee' | 'dueDate' | 'description';
  beforeValue?: string | null;
  afterValue?: string | null;
  changedById: number;
  createdAt: string;
  changedBy?: {
    id: number;
    name: string;
    username?: string | null;
  };
}

export interface MilestoneBoardDeliverable {
  id: number;
  milestoneId: number;
  content: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneBoardItem {
  id: number;
  projectId: number;
  title: string;
  owner: string;
  due: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  risk: 'low' | 'medium' | 'high';
  progress: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deliverables: MilestoneBoardDeliverable[];
}

export interface EfficiencyData {
  projectId: number;
  projectName: string;
  metrics: {
    requirementCount: number;
    approvedRate: number;
    doneRate: number;
    bugCount: number;
    openBugCount: number;
    resolvedBugCount: number;
    avgResolutionDays: number;
    sprintCount: number;
    completedSprintCount: number;
    workItemCount: number;
    doneWorkItemRate: number;
    totalCost: number;
    laborCost: number;
    outsourceCost: number;
    cloudCost: number;
    onTimeDeliveryRate: number;
  };
}
