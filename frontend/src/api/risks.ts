import { apiGet } from './client';
import type { RiskAlertsResponse } from '../types';
import { apiPut } from './client';

export async function listRiskAlerts(params: {
  thresholdDays?: number;
  progressThreshold?: number;
  viewId?: string;
  filterProject?: string;
  filterStatus?: string;
  filterAssignee?: string;
  filterRisk?: string;
  includeMilestones?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params.thresholdDays !== undefined) qs.set('thresholdDays', String(params.thresholdDays));
  if (params.progressThreshold !== undefined) qs.set('progressThreshold', String(params.progressThreshold));
  if (params.viewId) qs.set('viewId', params.viewId);
  if (params.filterProject) qs.set('filterProject', params.filterProject);
  if (params.filterStatus) qs.set('filterStatus', params.filterStatus);
  if (params.filterAssignee) qs.set('filterAssignee', params.filterAssignee);
  if (params.filterRisk) qs.set('filterRisk', params.filterRisk);
  if (params.includeMilestones !== undefined) qs.set('includeMilestones', String(params.includeMilestones));

  return apiGet<RiskAlertsResponse>(`/risks?${qs.toString()}`);
}

export async function getRiskRules() {
  return apiGet<Array<{
    id: number;
    key: string;
    type: string;
    name: string;
    enabled: boolean;
    thresholdDays: number;
    progressThreshold: number;
    includeMilestones: boolean;
    autoNotify: boolean;
    blockedValue?: string | null;
  }>>('/risks/rules');
}

export async function updateRiskRule(input: {
  key?: string;
  thresholdDays?: number;
  progressThreshold?: number;
  includeMilestones?: boolean;
  autoNotify?: boolean;
  enabled?: boolean;
  blockedValue?: string;
}) {
  const body: Record<string, unknown> = {};
  if (input.key) body.key = input.key;
  if (input.thresholdDays !== undefined) body.thresholdDays = String(input.thresholdDays);
  if (input.progressThreshold !== undefined) body.progressThreshold = String(input.progressThreshold);
  if (input.includeMilestones !== undefined) body.includeMilestones = String(input.includeMilestones);
  if (input.autoNotify !== undefined) body.autoNotify = String(input.autoNotify);
  if (input.enabled !== undefined) body.enabled = String(input.enabled);
  if (input.blockedValue !== undefined) body.blockedValue = input.blockedValue;
  return apiPut('/risks/rules', body);
}

export async function listAllRiskAlerts(params: {
  viewId?: string;
  filterProject?: string;
  filterStatus?: string;
  filterAssignee?: string;
  filterRisk?: string;
}) {
  const qs = new URLSearchParams();
  if (params.viewId) qs.set('viewId', params.viewId);
  if (params.filterProject) qs.set('filterProject', params.filterProject);
  if (params.filterStatus) qs.set('filterStatus', params.filterStatus);
  if (params.filterAssignee) qs.set('filterAssignee', params.filterAssignee);
  if (params.filterRisk) qs.set('filterRisk', params.filterRisk);
  return apiGet<RiskAlertsResponse>(`/risks/all?${qs.toString()}`);
}

export async function listRiskRuleLogs() {
  return apiGet<Array<{ id: number; ruleId: number; action: string; note?: string | null; createdAt: string }>>('/risks/rules/logs');
}
