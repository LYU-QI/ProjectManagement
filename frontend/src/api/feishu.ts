import { apiDelete, apiGet, apiPost, apiPut } from './client';

export type FeishuRecord = {
  record_id: string;
  fields: Record<string, unknown>;
};

export type FeishuListResponse = {
  items: FeishuRecord[];
  page_token?: string;
  has_more?: boolean;
  search_applied?: boolean;
};

export async function listFeishuRecords(params: {
  pageSize?: number;
  pageToken?: string;
  viewId?: string;
  filter?: string;
  sort?: string;
  fieldNames?: string;
  textFieldAsArray?: boolean;
  displayFormulaRef?: boolean;
  automaticFields?: boolean;
  userIdType?: string;
  search?: string;
  searchFields?: string;
  filterProject?: string;
  filterStatus?: string;
  filterAssignee?: string;
  filterRisk?: string;
}) {
  const qs = new URLSearchParams();
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.pageToken) qs.set('pageToken', params.pageToken);
  if (params.viewId) qs.set('viewId', params.viewId);
  if (params.filter) qs.set('filter', params.filter);
  if (params.sort) qs.set('sort', params.sort);
  if (params.fieldNames) qs.set('fieldNames', params.fieldNames);
  if (params.textFieldAsArray !== undefined) qs.set('textFieldAsArray', String(params.textFieldAsArray));
  if (params.displayFormulaRef !== undefined) qs.set('displayFormulaRef', String(params.displayFormulaRef));
  if (params.automaticFields !== undefined) qs.set('automaticFields', String(params.automaticFields));
  if (params.userIdType) qs.set('userIdType', params.userIdType);
  if (params.search) qs.set('search', params.search);
  if (params.searchFields) qs.set('searchFields', params.searchFields);
  if (params.filterProject) qs.set('filterProject', params.filterProject);
  if (params.filterStatus) qs.set('filterStatus', params.filterStatus);
  if (params.filterAssignee) qs.set('filterAssignee', params.filterAssignee);
  if (params.filterRisk) qs.set('filterRisk', params.filterRisk);

  return apiGet<FeishuListResponse>(`/feishu/records?${qs.toString()}`);
}

export async function createFeishuRecord(fields: Record<string, unknown>) {
  return apiPost<Record<string, unknown>>('/feishu/records', { fields });
}

export async function updateFeishuRecord(recordId: string, fields: Record<string, unknown>) {
  return apiPut<Record<string, unknown>>(`/feishu/records/${encodeURIComponent(recordId)}`, { fields });
}

export async function deleteFeishuRecord(recordId: string) {
  await apiDelete(`/feishu/records/${encodeURIComponent(recordId)}`);
}
