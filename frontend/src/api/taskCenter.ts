import { apiGet, apiPost } from './client';

export type TaskCenterSource = 'pm_assistant' | 'automation' | 'feishu' | 'ai_chat';
export type TaskCenterStatus = 'success' | 'failed' | 'dry-run' | 'skipped' | 'unknown';
export type TaskCenterSeverity = 'info' | 'warning' | 'critical';

export interface TaskCenterItem {
  id: string;
  source: TaskCenterSource;
  sourceLabel: string;
  status: TaskCenterStatus;
  title: string;
  summary: string;
  trigger?: string;
  actorName?: string;
  projectId?: number | null;
  projectName?: string | null;
  createdAt: string;
  detail?: string | null;
  errorCode?: string | null;
  errorCategory?: string | null;
  severity?: 'info' | 'warning' | 'critical';
  recoveryHint?: string | null;
  recoveryEntry?: string | null;
  recoveryChecklist?: string[];
  retryable?: boolean;
  retryMeta?: Record<string, unknown> | null;
}

export interface TaskCenterRetryResult {
  success: boolean;
  errorCode?: string | null;
  message: string;
}

export interface TaskCenterStats {
  total: number;
  bySource: Record<TaskCenterSource, number>;
  byStatus: Record<TaskCenterStatus, number>;
  bySourceStatus: Record<TaskCenterSource, Record<TaskCenterStatus, number>>;
  successRate: number;
  topErrorCodes: Array<{
    errorCode: string;
    count: number;
    severity: TaskCenterSeverity;
    sourceLabel: string;
  }>;
  recentFailures: Array<{
    id: string;
    title: string;
    sourceLabel: string;
    createdAt: string;
  }>;
  trend: Array<{
    day: string;
    total: number;
    failed: number;
  }>;
}

export async function listTaskCenterItems(params?: {
  projectId?: number | null;
  source?: TaskCenterSource | 'all';
  status?: TaskCenterStatus | 'all';
  severity?: TaskCenterSeverity | 'all';
  errorCode?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set('projectId', String(params.projectId));
  if (params?.source && params.source !== 'all') qs.set('source', params.source);
  if (params?.status && params.status !== 'all') qs.set('status', params.status);
  if (params?.severity && params.severity !== 'all') qs.set('severity', params.severity);
  if (params?.errorCode) qs.set('errorCode', params.errorCode);
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString();
  return apiGet<TaskCenterItem[]>(`/task-center/items${suffix ? `?${suffix}` : ''}`);
}

export async function getTaskCenterStats(params?: {
  projectId?: number | null;
  source?: TaskCenterSource | 'all';
  days?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set('projectId', String(params.projectId));
  if (params?.source && params.source !== 'all') qs.set('source', params.source);
  if (params?.days) qs.set('days', String(params.days));
  const suffix = qs.toString();
  return apiGet<TaskCenterStats>(`/task-center/stats${suffix ? `?${suffix}` : ''}`);
}

export async function retryTaskCenterItem(source: TaskCenterSource, retryMeta: Record<string, unknown>) {
  return apiPost<TaskCenterRetryResult>('/task-center/retry', {
    source,
    retryMeta
  });
}
