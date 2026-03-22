import { apiDelete, apiGet, apiPatch, apiPost } from './client';

interface OrgInfo {
  id: string;
  slug: string;
  name: string;
  plan: string;
  orgRole: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
}

interface OrgDetail {
  id: string;
  slug: string;
  name: string;
  plan: string;
  maxMembers: number;
  memberCount: number;
}

interface OrgMember {
  userId: number;
  name: string;
  username: string;
  globalRole: string;
  orgRole: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
}

export async function listOrganizations(): Promise<OrgInfo[]> {
  return apiGet<OrgInfo[]>('/organizations');
}

export async function getOrganization(id: string): Promise<OrgDetail> {
  return apiGet<OrgDetail>(`/organizations/${id}`);
}

export async function createOrganization(data: { slug: string; name: string; plan?: string; maxMembers?: number }): Promise<OrgDetail> {
  return apiPost<OrgDetail>('/organizations', data);
}

export async function updateOrganization(id: string, data: { name?: string; plan?: string; maxMembers?: number }): Promise<OrgDetail> {
  return apiPatch<OrgDetail>(`/organizations/${id}`, data);
}

export async function deleteOrganization(id: string): Promise<void> {
  return apiDelete(`/organizations/${id}`);
}

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  return apiGet<OrgMember[]>(`/organizations/${orgId}/members`);
}

export async function inviteOrgMember(orgId: string, userId: string, role?: string): Promise<OrgMember> {
  return apiPost<OrgMember>(`/organizations/${orgId}/members/invite`, { userId, role });
}

export async function updateOrgMemberRole(orgId: string, userId: string, role: string): Promise<void> {
  return apiPatch<void>(`/organizations/${orgId}/members/${userId}`, { role });
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  return apiDelete(`/organizations/${orgId}/members/${userId}`);
}
