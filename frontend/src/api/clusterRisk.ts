import { ClusterRiskBoardResponse } from '../types';
import { apiGet, apiPost, apiPut } from './client';

export type ClusterRiskUpdatePayload = {
  projectName: string;
  projectId: string;
  ownerOne: string;
  pm: string;
  riskLight: string;
  deliveryScope: string;
  hasKeyDemo: boolean | null;
  weeklyProgress: string;
  dailyRiskHelp: string;
  urgentStaffingGap: string;
  qualityGap: string;
};

export function getClusterRiskBoard(force = false) {
  return apiGet<ClusterRiskBoardResponse>(`/dashboard/cluster-risk-board${force ? '?force=true' : ''}`);
}

export function createClusterRiskStatus(body: Partial<ClusterRiskUpdatePayload> & {
  projectName: string;
  projectId?: string;
  pm: string;
}) {
  return apiPost<{ ok: true; recordId?: string }>('/dashboard/cluster-risk-board', body);
}

export function updateClusterRiskStatus(recordId: string, body: ClusterRiskUpdatePayload) {
  return apiPut<{ ok: true }>(`/dashboard/cluster-risk-board/${encodeURIComponent(recordId)}`, body);
}
