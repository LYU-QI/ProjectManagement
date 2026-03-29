import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export type SprintStatus = 'planning' | 'active' | 'completed' | 'cancelled';

export interface Sprint {
  id: number;
  projectId: number;
  organizationId?: string | null;
  name: string;
  goal?: string | null;
  status: SprintStatus;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: number;
    name: string;
    alias?: string | null;
  };
}

export interface SprintListResponse {
  items: Sprint[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateSprintInput {
  projectId: number;
  name: string;
  goal?: string;
  status?: SprintStatus;
  startDate?: string;
  endDate?: string;
}

export interface UpdateSprintInput {
  name?: string;
  goal?: string;
  status?: SprintStatus;
  startDate?: string;
  endDate?: string;
}

export async function listSprints(params: {
  projectId?: number;
  page?: number;
  limit?: number;
}): Promise<SprintListResponse> {
  const query = new URLSearchParams();
  if (params.projectId) query.set('projectId', String(params.projectId));
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<SprintListResponse>(`/sprints${qs ? `?${qs}` : ''}`);
}

export async function getSprint(id: number): Promise<Sprint> {
  return apiGet<Sprint>(`/sprints/${id}`);
}

export async function createSprint(input: CreateSprintInput): Promise<Sprint> {
  return apiPost<Sprint>('/sprints', input as unknown as Record<string, unknown>);
}

export async function updateSprint(id: number, input: UpdateSprintInput): Promise<Sprint> {
  return apiPatch<Sprint>(`/sprints/${id}`, input as unknown as Record<string, unknown>);
}

export async function deleteSprint(id: number): Promise<void> {
  await apiDelete(`/sprints/${id}`);
}
