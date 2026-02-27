import { apiPatch } from './client';
import type { UserItem } from '../types';

export function updateUserRole(id: number, role: UserItem['role']) {
  return apiPatch<UserItem>(`/users/${id}/role`, { role });
}
