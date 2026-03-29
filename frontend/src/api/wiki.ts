import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export type WikiPage = {
  id: number;
  projectId: number;
  organizationId: string | null;
  parentId: number | null;
  title: string;
  content: string;
  type: 'document' | 'folder';
  slug: string;
  sortOrder: number;
  creatorId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateWikiPagePayload = {
  projectId: number;
  parentId?: number;
  title: string;
  content?: string;
  type?: 'document' | 'folder';
};

export type UpdateWikiPagePayload = {
  title?: string;
  content?: string;
  parentId?: number | null;
  sortOrder?: number;
};

export async function listWikiPages(projectId: number) {
  return apiGet<WikiPage[]>(`/wiki/pages?projectId=${projectId}`);
}

export async function getWikiPage(id: number) {
  return apiGet<WikiPage>(`/wiki/pages/${id}`);
}

export async function createWikiPage(payload: CreateWikiPagePayload) {
  return apiPost<WikiPage>('/wiki/pages', payload);
}

export async function updateWikiPage(id: number, payload: UpdateWikiPagePayload) {
  return apiPatch<WikiPage>(`/wiki/pages/${id}`, payload);
}

export async function deleteWikiPage(id: number) {
  await apiDelete(`/wiki/pages/${id}`);
}
