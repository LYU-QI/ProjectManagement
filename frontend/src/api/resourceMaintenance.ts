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
  roles: string[];
  levels: string[];
  locations: string[];
  statuses: string[];
  allocationTypes: string[];
  availabilityTypes: string[];
};

export function listResourceMaintenance(kind: ResourceMaintenanceKind) {
  return apiGet<ResourceMaintenanceList>(`/resource-maintenance/${kind}`);
}

export function getResourceMaintenanceOptions() {
  return apiGet<ResourceMaintenanceOptions>('/resource-maintenance/options');
}

export function createResourceMaintenance(kind: ResourceMaintenanceKind, body: Record<string, unknown>) {
  return apiPost<{ ok: true; result: unknown }>(`/resource-maintenance/${kind}`, body);
}

export function updateResourceMaintenance(kind: ResourceMaintenanceKind, recordId: string, body: Record<string, unknown>) {
  return apiPut<{ ok: true; result: unknown }>(`/resource-maintenance/${kind}/${encodeURIComponent(recordId)}`, body);
}
