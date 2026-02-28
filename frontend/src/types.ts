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

export interface Requirement {
  id: number;
  projectId: number;
  projectSeq?: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  changeCount: number;
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
  role: 'super_admin' | 'project_director' | 'project_manager' | 'pm' | 'lead' | 'viewer';
  username: string;
}

export interface AuditLogItem {
  id: number;
  userName?: string;
  userRole?: string;
  method: string;
  path: string;
  projectId?: number;
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
  createdAt: string;
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
