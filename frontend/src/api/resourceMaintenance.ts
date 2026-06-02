import { apiGet, apiPost, apiPut } from './client';

export type ResourceMaintenanceKind = 'people' | 'allocations' | 'availability';

export type ResourceMaintenanceRow = {
  recordId: string;
  fields: Record<string, unknown>;
};

export type ResourceMaintenanceList = {
  generatedAt: string;
  items: ResourceMaintenanceRow[];
};

export type ResourceMaintenanceOptions = {
  generatedAt: string;
  people: Array<{
    personId: string;
    name: string;
    role: string;
    department: string;
    level: string;
    location: string;
    dailyCapacity: string;
    status: string;
  }>;
  projects: Array<{
    projectId: string;
    projectName: string;
    alias: string;
    startDate: string;
    endDate: string;
  }>;
  departments: string[];
  systemDepartments?: string[];
  roles: string[];
  levels: string[];
  locations: string[];
  statuses: string[];
  allocationTypes: string[];
  availabilityTypes: string[];
};

export type DepartmentSyncStatus = 'matched' | 'pending' | 'system_unassigned' | 'unmatched';

export type DepartmentSyncPreviewItem = {
  recordId: string;
  personId: string;
  name: string;
  feishuDepartment: string;
  systemDepartment: string;
  status: DepartmentSyncStatus;
  message: string;
};

export type DepartmentSyncPreview = {
  summary: {
    total: number;
    matched: number;
    pending: number;
    systemUnassigned: number;
    unmatched: number;
    updated?: number;
    createdDepartments?: number;
  };
  items: DepartmentSyncPreviewItem[];
};

export function listResourceMaintenance(kind: ResourceMaintenanceKind) {
  return apiGet<ResourceMaintenanceList>(`/resource-maintenance/${kind}`);
}

export function getResourceMaintenanceOptions() {
  return apiGet<ResourceMaintenanceOptions>('/resource-maintenance/options');
}

export function previewDepartmentSync() {
  return apiGet<DepartmentSyncPreview>('/resource-maintenance/department-sync/preview');
}

export function syncSystemDepartmentsToFeishu() {
  return apiPost<{ summary: DepartmentSyncPreview['summary']; results: Array<{ recordId: string; personId: string; name: string; status: 'success' | 'failed'; message: string }>; preview: DepartmentSyncPreview }>('/resource-maintenance/department-sync/system-to-feishu', {});
}

export function fillSystemDepartmentsFromFeishu() {
  return apiPost<{ summary: { total: number; updated: number; failed: number; skipped: number; createdDepartments: number }; results: Array<{ personId: string; name: string; department: string; status: 'success' | 'failed' | 'skipped'; message: string }> }>('/resource-maintenance/department-sync/feishu-to-system', {});
}

export function createResourceMaintenance(kind: ResourceMaintenanceKind, body: Record<string, unknown>) {
  return apiPost<{ ok: true; result: unknown }>(`/resource-maintenance/${kind}`, body);
}

export function updateResourceMaintenance(kind: ResourceMaintenanceKind, recordId: string, body: Record<string, unknown>) {
  return apiPut<{ ok: true; result: unknown }>(`/resource-maintenance/${kind}/${encodeURIComponent(recordId)}`, body);
}
