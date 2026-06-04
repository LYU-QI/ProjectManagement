import { ClusterRiskBoardResponse } from '../types';
import { apiGet, apiPost, apiPut } from './client';

export type ClusterRiskUpdatePayload = {
  projectName: string;
  projectId: string;
  projectStage: string;
  deliveryStatus: string;
  ownerOne: string;
  pm: string;
  riskLight: string;
  riskTrend: string;
  riskCategory: string;
  keyRiskSummary: string;
  riskImpact: string;
  weeklyProgress: string;
  dailyRiskHelp: string;
  riskResolution: string;
  nextAction: string;
  actionOwner: string;
  actionDueDate: string;
  needsEscalation: string;
  escalationRequest: string;
  deliveryScope: string;
  hasKeyDemo: boolean | null;
  qualityGap: string;
  qualityLevel: string;
  updatedAt: string;
  updatedBy: string;
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
