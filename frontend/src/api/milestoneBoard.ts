import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import type { MilestoneBoardItem, MilestoneBoardDeliverable } from '../types';

type CreateItemPayload = {
  projectId: number;
  title: string;
  owner: string;
  due: string;
  status?: 'upcoming' | 'in_progress' | 'completed';
  risk?: 'low' | 'medium' | 'high';
  progress?: number;
  deliverables?: Array<{ content: string; done?: boolean }>;
};

type UpdateItemPayload = {
  title?: string;
  owner?: string;
  due?: string;
  status?: 'upcoming' | 'in_progress' | 'completed';
  risk?: 'low' | 'medium' | 'high';
  progress?: number;
};

type ImportPayload = {
  projectId: number;
  migrationToken?: string;
  items: Array<{
    title: string;
    owner: string;
    due: string;
    status?: string;
    risk?: string;
    progress?: number;
    deliverables?: Array<{ content: string; done?: boolean }>;
  }>;
};

export async function listMilestoneBoardItems(projectId: number) {
  return apiGet<{ items: MilestoneBoardItem[] }>(`/projects/${projectId}/milestone-board`);
}

export async function createMilestoneBoardItem(projectId: number, payload: Omit<CreateItemPayload, 'projectId'>) {
  return apiPost<MilestoneBoardItem>('/milestone-board', { ...payload, projectId });
}

export async function updateMilestoneBoardItem(id: number, payload: UpdateItemPayload) {
  return apiPatch<MilestoneBoardItem>(`/milestone-board/${id}`, payload);
}

export async function deleteMilestoneBoardItem(id: number) {
  await apiDelete(`/milestone-board/${id}`);
}

export async function addMilestoneDeliverable(milestoneId: number, content: string) {
  return apiPost<MilestoneBoardDeliverable>(`/milestone-board/${milestoneId}/deliverables`, { content });
}

export async function updateMilestoneDeliverable(id: number, payload: { content?: string; done?: boolean }) {
  return apiPatch<MilestoneBoardDeliverable>(`/milestone-board/deliverables/${id}`, payload);
}

export async function deleteMilestoneDeliverable(id: number) {
  await apiDelete(`/milestone-board/deliverables/${id}`);
}

export async function importMilestoneBoardLocal(projectId: number, payload: Omit<ImportPayload, 'projectId'>) {
  return apiPost<{ imported: number }>('/milestone-board/import', { ...payload, projectId });
}
