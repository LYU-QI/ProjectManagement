import { apiGet } from './client';
import type { EfficiencyData } from '../types';

export function getEfficiency(projectId: number): Promise<EfficiencyData> {
  return apiGet<EfficiencyData>(`/dashboard/efficiency?projectId=${projectId}`);
}
