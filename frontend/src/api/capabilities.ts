import { apiGet, apiPost } from './client';

export interface CapabilityTemplateItem {
  id: string;
  organizationId?: string | null;
  projectId?: number | null;
  scene: string;
  name: string;
  description?: string | null;
  systemPrompt?: string | null;
  userPromptTemplate?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listCapabilityTemplates(params?: { scene?: string; projectId?: number | null }) {
  const qs = new URLSearchParams();
  if (params?.scene) qs.set('scene', params.scene);
  if (params?.projectId) qs.set('projectId', String(params.projectId));
  const suffix = qs.toString();
  return apiGet<CapabilityTemplateItem[]>(`/capabilities/templates${suffix ? `?${suffix}` : ''}`);
}

export async function saveCapabilityTemplate(input: {
  scene: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  projectId?: number | null;
  enabled?: boolean;
}) {
  return apiPost<CapabilityTemplateItem>('/capabilities/templates', {
    ...input,
    projectId: input.projectId ?? undefined
  });
}
