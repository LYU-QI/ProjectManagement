import { apiPatch, apiPost } from './client';
import type { UserItem } from '../types';

export function updateUserRole(id: number, role: UserItem['role']) {
  return apiPatch<UserItem>(`/users/${id}/role`, { role });
}

export function createUser(input: {
  username: string;
  name: string;
  password: string;
  role: UserItem['role'];
}) {
  return apiPost<UserItem>('/users', input);
}

export function resetUserPassword(id: number, password: string) {
  return apiPatch<{ ok: true; id: number; username?: string }>(`/users/${id}/password`, { password });
}
