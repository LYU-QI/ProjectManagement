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
  }>;
}

export interface Requirement {
  id: number;
  projectId: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  changeCount: number;
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

export interface ProjectItem {
  id: number;
  name: string;
  budget: number;
  startDate?: string | null;
  endDate?: string | null;
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
  taskTitle?: string;
  hours: number;
  hourlyRate: number;
  workedOn: string;
  note?: string;
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

export interface AuditLogItem {
  id: number;
  userName?: string;
  userRole?: string;
  method: string;
  path: string;
  projectId?: number;
  createdAt: string;
}

export interface AuthUser {
  id: number;
  name: string;
  role: string;
}
