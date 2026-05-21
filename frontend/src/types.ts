export type FeishuFormState = {
  任务ID: string;
  任务名称: string;
  状态: string;
  优先级: string;
  负责人: string;
  开始时间: string;
  截止时间: string;
  进度: string;
  所属项目: string;
  是否阻塞: string;
  阻塞原因: string;
  风险等级: string;
  '依赖/前置条件': string;
  里程碑: string;
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
  index: string;
  projectName: string;
  projectId: string;
  ownerPm: string;
  riskLight: ClusterRiskLight;
  deliveryScope: string;
  hasKeyDemo: boolean | null;
  weeklyProgress: string;
  dailyRiskHelp: string;
  riskResolution: string;
  qualityGap: string;
  qualityLevel: string;
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
  milestoneName: string;
  techDetail: string;
  iconStyle: string;
  hasFlag: boolean;
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
  level: string;
  location: string;
  dailyCapacity: number;
  status: string;
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
