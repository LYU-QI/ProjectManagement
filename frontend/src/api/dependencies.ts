import { apiDelete, apiGet, apiPost } from './client';
import type { FeishuDependency } from '../types';

export async function listDependencies(projectName?: string) {
  const qs = new URLSearchParams();
  if (projectName) qs.set('project', projectName);
  return apiGet<FeishuDependency[]>(`/schedule-dependencies?${qs.toString()}`);
}

export async function createDependency(input: {
  projectName: string;
  taskRecordId: string;
  taskId?: string;
  dependsOnRecordId: string;
  dependsOnTaskId?: string;
  type: 'FS' | 'SS' | 'FF';
}) {
  return apiPost<FeishuDependency>('/schedule-dependencies', input);
}

export async function deleteDependency(id: number) {
  return apiDelete(`/schedule-dependencies/${id}`);
}
