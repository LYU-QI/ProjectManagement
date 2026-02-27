import { apiDelete, apiGet, apiPost } from './client';
import type { ProjectMembershipItem } from '../types';

export function listProjectMemberships() {
  return apiGet<ProjectMembershipItem[]>('/project-memberships');
}

export function createProjectMembership(input: {
  userId: number;
  projectId: number;
  role: 'director' | 'manager' | 'member' | 'viewer';
}) {
  return apiPost<ProjectMembershipItem>('/project-memberships', input);
}

export function removeProjectMembership(id: number) {
  return apiDelete(`/project-memberships/${id}`);
}

