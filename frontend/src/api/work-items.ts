import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import type { WorkItem, WorkItemHistory } from '../types';

export type WorkItemStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';

export type WorkItemListQuery = {
  projectId?: number;
  scope?: 'project' | 'personal' | 'all';
  status?: WorkItemStatus;
  type?: 'todo' | 'issue';
  priority?: 'low' | 'medium' | 'high';
  assigneeId?: number;
  assigneeName?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  parentId?: number;
  hasParent?: 'true' | 'false';
  showSubtasks?: boolean;
};

export type WorkItemListResponse = {
  items: WorkItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateWorkItemPayload = {
  projectId?: number;
  title: string;
  description?: string;
  type: 'todo' | 'issue';
  priority?: 'low' | 'medium' | 'high';
  assigneeId?: number;
  assigneeName?: string;
  dueDate?: string;
  parentId?: number;
};

export type UpdateWorkItemPayload = {
  title?: string;
  description?: string | null;
  type?: 'todo' | 'issue';
  priority?: 'low' | 'medium' | 'high';
  status?: WorkItemStatus;
  assigneeId?: number | null;
  assigneeName?: string | null;
  dueDate?: string | null;
  parentId?: number | null;
};

export async function listWorkItems(query: WorkItemListQuery) {
  const qs = new URLSearchParams();
  if (query.projectId != null) qs.set('projectId', String(query.projectId));
  if (query.scope) qs.set('scope', query.scope);
  if (query.status) qs.set('status', query.status);
  if (query.type) qs.set('type', query.type);
  if (query.priority) qs.set('priority', query.priority);
  if (query.assigneeId != null) qs.set('assigneeId', String(query.assigneeId));
  if (query.assigneeName) qs.set('assigneeName', query.assigneeName);
  if (query.search) qs.set('search', query.search);
  if (query.page != null) qs.set('page', String(query.page));
  if (query.pageSize != null) qs.set('pageSize', String(query.pageSize));
  if (query.parentId != null) qs.set('parentId', String(query.parentId));
  if (query.hasParent) qs.set('hasParent', query.hasParent);
  if (query.showSubtasks) qs.set('showSubtasks', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<WorkItemListResponse>(`/work-items${suffix}`);
}

export async function createWorkItem(payload: CreateWorkItemPayload) {
  return apiPost<WorkItem>('/work-items', payload);
}

export async function updateWorkItem(id: number, payload: UpdateWorkItemPayload) {
  return apiPatch<WorkItem>(`/work-items/${id}`, payload);
}

export async function deleteWorkItem(id: number) {
  await apiDelete(`/work-items/${id}`);
}

export async function getWorkItemHistory(id: number) {
  return apiGet<WorkItemHistory[]>(`/work-items/${id}/history`);
}

export type BatchUpdateWorkItemPayload = {
  ids: number[];
  status?: WorkItemStatus;
  assigneeId?: number | null;
  assigneeName?: string | null;
  parentId?: number | null;
};

export async function batchUpdateWorkItems(payload: BatchUpdateWorkItemPayload) {
  return apiPatch<{ updated: number; ids: number[] }>('/work-items/batch', payload);
}
