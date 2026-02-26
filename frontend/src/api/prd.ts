import { API_BASE, apiDelete, apiGet, apiPost } from './client';
import type { PrdCompareResult, PrdDocument, PrdVersion } from '../types';
import { TOKEN_KEY } from './client';

export function listPrdDocuments(projectId?: number): Promise<PrdDocument[]> {
  const query = projectId ? `?projectId=${projectId}` : '';
  return apiGet<PrdDocument[]>(`/prd/documents${query}`);
}

export function createPrdDocument(projectId: number, title: string): Promise<PrdDocument> {
  return apiPost<PrdDocument>('/prd/documents', { projectId, title });
}

export async function deletePrdDocument(documentId: number) {
  return apiDelete(`/prd/documents/${documentId}`);
}

export async function deletePrdVersion(documentId: number, versionId: number) {
  return apiDelete(`/prd/documents/${documentId}/versions/${versionId}`);
}

export async function getPrdVersions(documentId: number): Promise<PrdVersion[]> {
  return apiGet<PrdVersion[]>(`/prd/documents/${documentId}/versions`);
}

export async function uploadPrdVersion(documentId: number, file: File, versionLabel?: string): Promise<PrdVersion> {
  const formData = new FormData();
  formData.append('file', file);
  if (versionLabel) formData.append('versionLabel', versionLabel);

  const res = await fetch(`${API_BASE}/prd/documents/${documentId}/versions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` },
    body: formData
  });

  if (!res.ok) {
    let msg = res.statusText;
    try { const err = await res.json(); msg = err.message || msg; } catch { }
    throw new Error(msg);
  }
  return res.json() as Promise<PrdVersion>;
}


export function comparePrdVersions(leftVersionId: number, rightVersionId: number): Promise<PrdCompareResult> {
  return apiPost<PrdCompareResult>('/prd/compare', { leftVersionId, rightVersionId });
}
