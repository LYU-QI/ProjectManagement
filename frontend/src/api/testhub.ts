import { apiDelete, apiGet, apiPatch, apiPost } from './client';

// --- Bug ---
export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'rejected';
export type BugSeverity = 'trivial' | 'minor' | 'major' | 'critical' | 'blocker';
export type BugPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Bug {
  id: number;
  projectId: number;
  organizationId?: string | null;
  testCaseId?: number | null;
  title: string;
  description?: string | null;
  steps?: string | null;
  severity: BugSeverity;
  priority: BugPriority;
  status: BugStatus;
  assigneeId?: number | null;
  assigneeName?: string | null;
  reporterId?: number | null;
  reporterName?: string | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { id: number; name: string };
  testCase?: { id: number; title: string } | null;
}

export interface BugListResponse {
  items: Bug[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateBugPayload {
  projectId: number;
  title: string;
  description?: string;
  steps?: string;
  severity?: BugSeverity;
  priority?: BugPriority;
  testCaseId?: number;
  assigneeId?: number;
  assigneeName?: string;
}

export interface UpdateBugPayload {
  title?: string;
  description?: string | null;
  steps?: string | null;
  severity?: BugSeverity;
  priority?: BugPriority;
  status?: BugStatus;
  assigneeId?: number | null;
  assigneeName?: string | null;
}

export async function listBugs(query: {
  projectId?: number;
  status?: BugStatus;
  severity?: BugSeverity;
  priority?: BugPriority;
  assigneeId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<BugListResponse> {
  const qs = new URLSearchParams();
  if (query.projectId != null) qs.set('projectId', String(query.projectId));
  if (query.status) qs.set('status', query.status);
  if (query.severity) qs.set('severity', query.severity);
  if (query.priority) qs.set('priority', query.priority);
  if (query.assigneeId != null) qs.set('assigneeId', String(query.assigneeId));
  if (query.search) qs.set('search', query.search);
  if (query.page != null) qs.set('page', String(query.page));
  if (query.pageSize != null) qs.set('pageSize', String(query.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<BugListResponse>(`/bugs${suffix}`);
}

export async function getBug(id: number): Promise<Bug> {
  return apiGet<Bug>(`/bugs/${id}`);
}

export async function createBug(payload: CreateBugPayload): Promise<Bug> {
  return apiPost<Bug>('/bugs', payload as unknown as Record<string, unknown>);
}

export async function updateBug(id: number, payload: UpdateBugPayload): Promise<Bug> {
  return apiPatch<Bug>(`/bugs/${id}`, payload as unknown as Record<string, unknown>);
}

export async function deleteBug(id: number): Promise<void> {
  await apiDelete(`/bugs/${id}`);
}

// --- Test Case ---
export type TestCaseStatus = 'draft' | 'active' | 'deprecated';
export type TestCasePriority = 'low' | 'medium' | 'high' | 'critical';

export interface TestCase {
  id: number;
  projectId: number;
  organizationId?: string | null;
  title: string;
  description?: string | null;
  preconditions?: string | null;
  steps?: unknown | null;
  expectedResult?: string | null;
  priority: TestCasePriority;
  status: TestCaseStatus;
  tags?: string | null;
  creatorId?: number | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { id: number; name: string };
  _count?: { testPlanItems: number; bugs: number };
}

export interface TestCaseListResponse {
  items: TestCase[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listTestCases(query: {
  projectId?: number;
  status?: TestCaseStatus;
  priority?: TestCasePriority;
  search?: string;
  tags?: string;
  page?: number;
  pageSize?: number;
}): Promise<TestCaseListResponse> {
  const qs = new URLSearchParams();
  if (query.projectId != null) qs.set('projectId', String(query.projectId));
  if (query.status) qs.set('status', query.status);
  if (query.priority) qs.set('priority', query.priority);
  if (query.search) qs.set('search', query.search);
  if (query.tags) qs.set('tags', query.tags);
  if (query.page != null) qs.set('page', String(query.page));
  if (query.pageSize != null) qs.set('pageSize', String(query.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<TestCaseListResponse>(`/test-cases${suffix}`);
}

export async function createTestCase(payload: {
  projectId: number;
  title: string;
  description?: string;
  preconditions?: string;
  steps?: unknown[];
  expectedResult?: string;
  priority?: TestCasePriority;
  status?: TestCaseStatus;
  tags?: string;
}): Promise<TestCase> {
  return apiPost<TestCase>('/test-cases', payload as unknown as Record<string, unknown>);
}

export async function updateTestCase(id: number, payload: Partial<{
  title: string;
  description?: string;
  preconditions?: string;
  steps?: unknown[];
  expectedResult?: string;
  priority?: TestCasePriority;
  status?: TestCaseStatus;
  tags?: string;
}>): Promise<TestCase> {
  return apiPatch<TestCase>(`/test-cases/${id}`, payload as unknown as Record<string, unknown>);
}

export async function deleteTestCase(id: number): Promise<void> {
  await apiDelete(`/test-cases/${id}`);
}

// --- Test Plan ---
export type TestPlanStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface TestPlanItem {
  id: number;
  planId: number;
  testCaseId: number;
  result?: string | null;
  notes?: string | null;
  executedAt?: Date | null;
  executorId?: number | null;
  createdAt: Date;
  testCase: {
    id: number;
    title: string;
    priority: TestCasePriority;
    status: TestCaseStatus;
    description?: string | null;
  };
}

export interface TestPlan {
  id: number;
  projectId: number;
  organizationId?: string | null;
  title: string;
  description?: string | null;
  status: TestPlanStatus;
  startDate?: string | null;
  endDate?: string | null;
  creatorId?: number | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { id: number; name: string };
  caseCount?: number;
  items?: TestPlanItem[];
}

export interface TestPlanListResponse {
  items: (TestPlan & { caseCount?: number })[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listTestPlans(query: {
  projectId?: number;
  status?: TestPlanStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<TestPlanListResponse> {
  const qs = new URLSearchParams();
  if (query.projectId != null) qs.set('projectId', String(query.projectId));
  if (query.status) qs.set('status', query.status);
  if (query.search) qs.set('search', query.search);
  if (query.page != null) qs.set('page', String(query.page));
  if (query.pageSize != null) qs.set('pageSize', String(query.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<TestPlanListResponse>(`/test-plans${suffix}`);
}

export async function getTestPlan(id: number): Promise<TestPlan> {
  return apiGet<TestPlan>(`/test-plans/${id}`);
}

export async function createTestPlan(payload: {
  projectId: number;
  title: string;
  description?: string;
  status?: TestPlanStatus;
  startDate?: string;
  endDate?: string;
}): Promise<TestPlan> {
  return apiPost<TestPlan>('/test-plans', payload);
}

export async function updateTestPlan(id: number, payload: Partial<{
  title: string;
  description?: string;
  status?: TestPlanStatus;
  startDate?: string;
  endDate?: string;
}>): Promise<TestPlan> {
  return apiPatch<TestPlan>(`/test-plans/${id}`, payload);
}

export async function deleteTestPlan(id: number): Promise<void> {
  await apiDelete(`/test-plans/${id}`);
}

export async function addTestCases(planId: number, testCaseIds: number[]): Promise<{ success: boolean; added: number }> {
  return apiPost<{ success: boolean; added: number }>(`/test-plans/${planId}/cases`, { testCaseIds });
}

export async function executeTestCase(
  planId: number,
  testCaseId: number,
  payload: { result?: 'passed' | 'failed' | 'blocked' | 'skipped'; notes?: string }
): Promise<TestPlanItem> {
  return apiPatch<TestPlanItem>(`/test-plans/${planId}/cases/${testCaseId}`, payload as unknown as Record<string, unknown>);
}
