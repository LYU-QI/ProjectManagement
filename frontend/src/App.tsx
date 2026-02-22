import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost, TOKEN_KEY, USER_KEY } from './api/client';
import {
  createFeishuRecord,
  deleteFeishuRecord,
  listFeishuRecords,
  updateFeishuRecord,
  FeishuRecord
} from './api/feishu';
import { FEISHU_DEFAULT_FORM, FEISHU_FIELD_NAMES } from './feishuConfig';
import type {
  AuthUser,
  AuditLogItem,
  CostEntryItem,
  CostSummary,
  DashboardOverview,
  FeishuFormState,
  NotificationItem,
  ProjectItem,
  Requirement,
  RiskData,
  ScheduleData,
  Worklog
} from './types';
import DashboardView from './views/DashboardView';
import RequirementsView from './views/RequirementsView';
import CostsView from './views/CostsView';
import ScheduleView from './views/ScheduleView';
import FeishuView from './views/FeishuView';
import NotificationsView from './views/NotificationsView';
import AuditView from './views/AuditView';
import AiView from './views/AiView';

type ViewKey = 'dashboard' | 'requirements' | 'costs' | 'schedule' | 'ai' | 'notifications' | 'audit' | 'feishu';

function focusInlineEditor(selector: string) {
  setTimeout(() => {
    const el = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement | null;
    if (!el) return;
    el.focus();
    if ('select' in el) {
      try {
        (el as HTMLInputElement).select();
      } catch {
        // ignore selection errors for non-input elements
      }
    }
  }, 0);
}

function useInlineEdit<T, Id>(config: {
  getId: (row: T) => Id;
  hasChanges: (original: T, draft: T) => boolean;
  selector: (id: Id, field: keyof T) => string;
}) {
  const [editingId, setEditingId] = useState<Id | null>(null);
  const [editingField, setEditingField] = useState<keyof T | null>(null);
  const [draft, setDraft] = useState<T | null>(null);

  function startEdit(row: T, field?: keyof T) {
    const id = config.getId(row);
    setEditingId(id);
    setDraft((prev) => (prev && config.getId(prev) === id ? prev : { ...row }));
    setEditingField(field ?? null);
    if (field) {
      focusInlineEditor(config.selector(id, field));
    }
  }

  function updateDraft(field: keyof T, value: string) {
    setDraft((prev) => (prev ? ({ ...prev, [field]: value } as T) : prev));
  }

  function hasDirty(original: T) {
    if (!draft) return false;
    return config.hasChanges(original, draft);
  }

  function finalize(original: T) {
    if (!draft) return;
    if (!config.hasChanges(original, draft)) {
      cancel();
      return;
    }
    setEditingField(null);
  }

  function cancel() {
    setEditingId(null);
    setEditingField(null);
    setDraft(null);
  }

  return {
    editingId,
    editingField,
    draft,
    startEdit,
    updateDraft,
    hasDirty,
    finalize,
    cancel
  };
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });
  const [view, setView] = useState<ViewKey>(() => {
    const raw = localStorage.getItem('pm_view');
    if (!raw) return 'dashboard';
    const allowed: ViewKey[] = ['dashboard', 'requirements', 'costs', 'schedule', 'ai', 'notifications', 'audit', 'feishu'];
    return allowed.includes(raw as ViewKey) ? (raw as ViewKey) : 'dashboard';
  });
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [costEntries, setCostEntries] = useState<CostEntryItem[]>([]);
  const [worklogs, setWorklogs] = useState<Worklog[]>([]);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [aiReport, setAiReport] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function refreshAll(projectIdOverride?: number | null) {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [dashboardRes, projectList, unreadNotifications] = await Promise.all([
        apiGet<DashboardOverview>('/dashboard/overview'),
        apiGet<ProjectItem[]>('/projects'),
        apiGet<NotificationItem[]>('/notifications?unread=true')
      ]);

      setOverview(dashboardRes);
      setProjects(projectList);
      setSelectedProjectIds((prev) => prev.filter((id) => projectList.some((item) => item.id === id)));
      setNotifications(unreadNotifications);

      const activeProjectId = projectIdOverride ?? selectedProjectId ?? projectList[0]?.id ?? null;
      setSelectedProjectId(activeProjectId);

      if (!activeProjectId) {
        setRequirements([]);
        setCostSummary(null);
        setCostEntries([]);
        setWorklogs([]);
        setSchedule(null);
        setRisk(null);
        return;
      }

      const [reqRes, costRes, costListRes, worklogRes, scheduleRes, riskRes, projectNotifications] = await Promise.all([
        apiGet<Requirement[]>(`/requirements?projectId=${activeProjectId}`),
        apiGet<CostSummary>(`/cost-entries/summary?projectId=${activeProjectId}`),
        apiGet<CostEntryItem[]>(`/cost-entries?projectId=${activeProjectId}`),
        apiGet<Worklog[]>(`/worklogs?projectId=${activeProjectId}`),
        apiGet<ScheduleData>(`/projects/${activeProjectId}/schedule`),
        apiGet<RiskData>(`/projects/${activeProjectId}/risks`),
        apiGet<NotificationItem[]>(`/notifications?projectId=${activeProjectId}`)
      ]);
      setRequirements(reqRes);
      setCostSummary(costRes);
      setCostEntries(costListRes);
      setWorklogs(worklogRes);
      setSchedule(scheduleRes);
      setRisk(riskRes);
      setNotifications(projectNotifications);
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') {
        logout();
        setError('登录已失效，请重新登录。');
      } else {
        setError('数据加载失败，请确认后端服务已启动。');
      }
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setOverview(null);
    setProjects([]);
    setSelectedProjectIds([]);
    setSelectedProjectId(null);
    setRequirements([]);
    setCostSummary(null);
    setCostEntries([]);
    setWorklogs([]);
    setSchedule(null);
    setRisk(null);
    setAiReport('');
    setNotifications([]);
    setAuditLogs([]);
  }

  async function submitLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setMessage('');
    setError('');
    const form = new FormData(formEl);
    const username = String(form.get('username') || '');
    const password = String(form.get('password') || '');
    try {
      const res = await apiPost<{ token: string; user: AuthUser }>('/auth/login', { username, password });
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      formEl?.reset();
    } catch {
      setError('登录失败，请检查账号密码。');
    }
  }

  useEffect(() => {
    if (token) {
      void refreshAll();
    }
  }, [token]);

  useEffect(() => {
    localStorage.setItem('pm_view', view);
  }, [view]);

  async function submitRequirement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    if (!selectedProjectId) {
      setError('请先选择项目。');
      return;
    }
    const form = new FormData(formEl);
    await apiPost('/requirements', {
      projectId: selectedProjectId,
      title: String(form.get('title')),
      description: String(form.get('description')),
      priority: String(form.get('priority')),
      version: 'v1.0'
    });
    formEl?.reset();
    await refreshAll(selectedProjectId);
  }

  async function submitProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setMessage('');
    setError('');
    const form = new FormData(formEl);
    const name = String(form.get('name'));
    const budget = Number(form.get('budget'));

    if (!Number.isFinite(budget) || budget <= 0) {
      setError('预算必须是大于 0 的数字。');
      return;
    }

    try {
      const created = await apiPost<{ id: number }>('/projects', {
        name,
        ownerId: 1,
        budget,
        startDate: String(form.get('startDate') || ''),
        endDate: String(form.get('endDate') || '')
      });
      formEl?.reset();
      setMessage(`项目「${name}」已创建。`);
      await refreshAll(created.id);
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') {
        logout();
        setError('登录已失效，请重新登录后再试。');
      } else if (err instanceof Error && err.message === 'FORBIDDEN') {
        setError('当前账号没有创建项目权限，请使用 pm/lead 账号。');
      } else {
        const detail = err instanceof Error ? err.message : 'unknown';
        setError(`新增项目失败，请检查输入或后端服务状态。（${detail}）`);
      }
    }
  }

  async function deleteProject(project: ProjectItem) {
    if (!canWrite) return;
    if (!window.confirm(`确定删除项目「${project.name}」？该项目下需求/成本/任务会一起删除。`)) return;
    setMessage('');
    setError('');
    try {
      await apiDelete(`/projects/${project.id}`);
      setMessage(`项目「${project.name}」已删除。`);
      const fallback = projects.find((item) => item.id !== project.id)?.id ?? null;
      await refreshAll(fallback);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除项目失败。（${detail}）`);
    }
  }

  async function deleteSelectedProjects() {
    if (!canWrite || selectedProjectIds.length === 0) return;
    if (!window.confirm(`确定批量删除 ${selectedProjectIds.length} 个项目？关联需求/成本/任务会一起删除。`)) return;
    setMessage('');
    setError('');
    try {
      for (const id of selectedProjectIds) {
        await apiDelete(`/projects/${id}`);
      }
      const remain = projects.filter((item) => !selectedProjectIds.includes(item.id));
      const fallback = remain[0]?.id ?? null;
      setSelectedProjectIds([]);
      setMessage(`已批量删除 ${selectedProjectIds.length} 个项目。`);
      await refreshAll(fallback);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`批量删除项目失败。（${detail}）`);
    }
  }

  function toggleProjectSelection(id: number, checked: boolean) {
    setSelectedProjectIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  }

  function handleInlineKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    onSave: () => void,
    onCancel: () => void
  ) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      onSave();
    }
  }

  async function saveInlineProjectEdit(original: ProjectItem) {
    if (!projectEdit.draft || !projectEdit.hasDirty(original)) return;
    setMessage('');
    setError('');
    const budget = Number(projectEdit.draft.budget);
    if (!Number.isFinite(budget) || budget <= 0) {
      setError('预算必须是大于 0 的数字。');
      return;
    }
    try {
      await apiPatch(`/projects/${original.id}`, {
        name: String(projectEdit.draft.name || ''),
        budget,
        startDate: projectEdit.draft.startDate || null,
        endDate: projectEdit.draft.endDate || null
      });
      setMessage(`项目「${projectEdit.draft.name}」已更新。`);
      projectEdit.cancel();
      await refreshAll(original.id);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新项目失败。（${detail}）`);
    }
  }

  async function saveInlineRequirementEdit(original: Requirement) {
    if (!requirementEdit.draft || !requirementEdit.hasDirty(original)) return;
    const priority = String(requirementEdit.draft.priority);
    const status = String(requirementEdit.draft.status);
    if (!['low', 'medium', 'high'].includes(priority)) {
      setError('优先级只能是 low/medium/high。');
      return;
    }
    if (!['draft', 'in_review', 'approved', 'planned', 'done'].includes(status)) {
      setError('状态只能是 draft/in_review/approved/planned/done。');
      return;
    }
    setMessage('');
    setError('');
    try {
      await apiPatch(`/requirements/${original.id}`, {
        title: requirementEdit.draft.title,
        description: requirementEdit.draft.description,
        priority,
        status
      });
      setMessage(`需求 #${original.id} 已更新。`);
      requirementEdit.cancel();
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新需求失败。（${detail}）`);
    }
  }

  async function saveInlineCostEdit(original: CostEntryItem) {
    if (!costEdit.draft || !costEdit.hasDirty(original)) return;
    const amount = Number(costEdit.draft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('金额必须是非负数字。');
      return;
    }
    const type = String(costEdit.draft.type);
    if (!['labor', 'outsource', 'cloud'].includes(type)) {
      setError('成本类型只能是 labor/outsource/cloud。');
      return;
    }
    setMessage('');
    setError('');
    try {
      await apiPatch(`/cost-entries/${original.id}`, {
        type,
        amount,
        occurredOn: costEdit.draft.occurredOn,
        note: costEdit.draft.note
      });
      setMessage(`成本条目 #${original.id} 已更新。`);
      costEdit.cancel();
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新成本失败。（${detail}）`);
    }
  }

  async function saveInlineWorklogEdit(original: Worklog) {
    if (!worklogEdit.draft || !worklogEdit.hasDirty(original)) return;
    const hours = Number(worklogEdit.draft.hours);
    const hourlyRate = Number(worklogEdit.draft.hourlyRate);
    if (!Number.isFinite(hours) || hours <= 0) {
      setError('工时必须是大于 0 的数字。');
      return;
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      setError('时薪必须是非负数字。');
      return;
    }
    setMessage('');
    setError('');
    try {
      await apiPatch(`/worklogs/${original.id}`, {
        taskTitle: worklogEdit.draft.taskTitle,
        hours,
        hourlyRate,
        workedOn: worklogEdit.draft.workedOn,
        note: worklogEdit.draft.note
      });
      setMessage(`工时 #${original.id} 已更新。`);
      worklogEdit.cancel();
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新工时失败。（${detail}）`);
    }
  }

  async function saveInlineTaskEdit(original: ScheduleData['tasks'][number]) {
    if (!taskEdit.draft || !taskEdit.hasDirty(original)) return;
    const status = String(taskEdit.draft.status);
    if (!['todo', 'in_progress', 'blocked', 'done'].includes(status)) {
      setError('状态只能是 todo/in_progress/blocked/done。');
      return;
    }
    setMessage('');
    setError('');
    try {
      await apiPatch(`/projects/tasks/${original.id}`, {
        title: taskEdit.draft.title,
        assignee: taskEdit.draft.assignee,
        status,
        plannedStart: taskEdit.draft.plannedStart,
        plannedEnd: taskEdit.draft.plannedEnd
      });
      setMessage(`任务 #${original.id} 已更新。`);
      taskEdit.cancel();
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新任务失败。（${detail}）`);
    }
  }

  async function saveInlineMilestoneEdit(original: ScheduleData['milestones'][number]) {
    if (!milestoneEdit.draft || !milestoneEdit.hasDirty(original)) return;
    setMessage('');
    setError('');
    try {
      await apiPatch(`/projects/milestones/${original.id}`, {
        name: milestoneEdit.draft.name,
        plannedDate: milestoneEdit.draft.plannedDate,
        actualDate: milestoneEdit.draft.actualDate || null
      });
      setMessage(`里程碑 #${original.id} 已更新。`);
      milestoneEdit.cancel();
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新里程碑失败。（${detail}）`);
    }
  }

  async function submitCost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    if (!selectedProjectId) {
      setError('请先选择项目。');
      return;
    }
    const form = new FormData(formEl);
    await apiPost('/cost-entries', {
      projectId: selectedProjectId,
      type: String(form.get('type')),
      amount: Number(form.get('amount')),
      occurredOn: String(form.get('occurredOn')),
      note: String(form.get('note'))
    });
    formEl?.reset();
    await refreshAll(selectedProjectId);
  }

  async function deleteCostEntry(entry: CostEntryItem) {
    if (!canWrite) return;
    if (!window.confirm(`确定删除成本条目 #${entry.id}？`)) return;
    setMessage('');
    setError('');
    try {
      await apiDelete(`/cost-entries/${entry.id}`);
      setMessage(`成本条目 #${entry.id} 已删除。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除成本失败。（${detail}）`);
    }
  }

  async function submitWorklog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    if (!selectedProjectId) {
      setError('请先选择项目。');
      return;
    }
    const form = new FormData(formEl);
    await apiPost('/worklogs', {
      projectId: selectedProjectId,
      userId: user?.id,
      taskTitle: String(form.get('taskTitle') || ''),
      hours: Number(form.get('hours')),
      hourlyRate: Number(form.get('hourlyRate')),
      workedOn: String(form.get('workedOn')),
      note: String(form.get('note') || '')
    });
    formEl?.reset();
    await refreshAll(selectedProjectId);
  }

  async function deleteWorklog(worklog: Worklog) {
    if (!canWrite) return;
    if (!window.confirm(`确定删除工时记录 #${worklog.id}？`)) return;
    setMessage('');
    setError('');
    try {
      await apiDelete(`/worklogs/${worklog.id}`);
      setMessage(`工时 #${worklog.id} 已删除。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除工时失败。（${detail}）`);
    }
  }

  async function submitMilestone(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    if (!selectedProjectId) {
      setError('请先选择项目。');
      return;
    }
    const form = new FormData(formEl);
    await apiPost('/projects/milestones', {
      projectId: selectedProjectId,
      name: String(form.get('name')),
      plannedDate: String(form.get('plannedDate'))
    });
    formEl?.reset();
    await refreshAll(selectedProjectId);
  }

  async function deleteMilestone(milestone: ScheduleData['milestones'][number]) {
    if (!canWrite) return;
    if (!window.confirm(`确定删除里程碑「${milestone.name}」？`)) return;
    setMessage('');
    setError('');
    try {
      await apiDelete(`/projects/milestones/${milestone.id}`);
      setMessage(`里程碑 #${milestone.id} 已删除。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除里程碑失败。（${detail}）`);
    }
  }

  async function submitTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    if (!selectedProjectId) {
      setError('请先选择项目。');
      return;
    }
    const form = new FormData(formEl);
    await apiPost('/projects/tasks', {
      projectId: selectedProjectId,
      title: String(form.get('title')),
      assignee: String(form.get('assignee')),
      status: String(form.get('status')),
      plannedStart: String(form.get('plannedStart')),
      plannedEnd: String(form.get('plannedEnd'))
    });
    formEl?.reset();
    await refreshAll(selectedProjectId);
  }

  async function deleteTask(task: ScheduleData['tasks'][number]) {
    if (!canWrite) return;
    if (!window.confirm(`确定删除任务「${task.title}」？`)) return;
    setMessage('');
    setError('');
    try {
      await apiDelete(`/projects/tasks/${task.id}`);
      setMessage(`任务 #${task.id} 已删除。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除任务失败。（${detail}）`);
    }
  }

  async function deleteRequirement(req: Requirement) {
    if (!canWrite) return;
    if (!window.confirm(`确定删除需求「${req.title}」？`)) return;
    setMessage('');
    setError('');
    try {
      await apiDelete(`/requirements/${req.id}`);
      setMessage(`需求 #${req.id} 已删除。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除需求失败。（${detail}）`);
    }
  }

  async function reviewRequirementAction(id: number, decision: 'approved' | 'rejected') {
    if (!canWrite) return;
    await apiPost(`/requirements/${id}/review`, {
      reviewer: user?.name ?? 'PM Demo',
      decision
    });
    await refreshAll(selectedProjectId);
  }

  async function markRequirementChanged(req: Requirement) {
    if (!canWrite) return;
    await apiPost(`/requirements/${req.id}/change`, {
      description: req.description,
      version: `v${req.changeCount + 1}.0`
    });
    await refreshAll(selectedProjectId);
  }

  async function generateReport() {
    if (!selectedProjectId) {
      setError('请先选择项目。');
      return;
    }
    const res = await apiPost<{ report: string }>('/ai/reports/weekly', {
      projectIds: [selectedProjectId],
      weekStart: '2026-02-16',
      weekEnd: '2026-02-22',
      includeRisks: true,
      includeBudget: true
    });
    setAiReport(res.report);
  }

  async function loadAuditLogs() {
    if (!selectedProjectId || !canWrite) return;
    const rows = await apiGet<AuditLogItem[]>(`/audit-logs?projectId=${selectedProjectId}`);
    setAuditLogs(rows);
  }

  async function markNotificationRead(id: number) {
    await apiPost(`/notifications/${id}/read`, {});
    await refreshAll(selectedProjectId);
  }

  const riskText = useMemo(() => {
    if (!risk) return 'N/A';
    return `${risk.riskLevel} (blocked: ${risk.blockedCount})`;
  }, [risk]);

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return '未选择';
    return projects.find((item) => item.id === selectedProjectId)?.name ?? `#${selectedProjectId}`;
  }, [projects, selectedProjectId]);
  const canWrite = user?.role === 'pm' || user?.role === 'lead';


  const [feishuRecords, setFeishuRecords] = useState<FeishuRecord[]>([]);
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [feishuError, setFeishuError] = useState('');
  const [feishuMessage, setFeishuMessage] = useState('');
  const [feishuForm, setFeishuForm] = useState<FeishuFormState>(FEISHU_DEFAULT_FORM);
  const [feishuEditingId, setFeishuEditingId] = useState<string | null>(null);
  const [feishuEditingField, setFeishuEditingField] = useState<keyof FeishuFormState | null>(null);
  const [feishuRecordDraft, setFeishuRecordDraft] = useState<FeishuFormState | null>(null);
  const [feishuPageSize, setFeishuPageSize] = useState(20);
  const [feishuPageToken, setFeishuPageToken] = useState<string | undefined>(undefined);
  const [feishuPageStack, setFeishuPageStack] = useState<string[]>([]);
  const [feishuNextToken, setFeishuNextToken] = useState<string | undefined>(undefined);
  const [feishuHasMore, setFeishuHasMore] = useState(false);
  const [feishuSearch, setFeishuSearch] = useState('');
  const [feishuSearchFields, setFeishuSearchFields] = useState('任务ID,任务名称,负责人');
  const [feishuFilter, setFeishuFilter] = useState('');
  const [feishuSort, setFeishuSort] = useState('');
  const [feishuFilterProject, setFeishuFilterProject] = useState('');
  const [feishuFilterStatus, setFeishuFilterStatus] = useState('');
  const [feishuFilterAssignee, setFeishuFilterAssignee] = useState('');
  const [feishuFilterRisk, setFeishuFilterRisk] = useState('');
  const projectEdit = useInlineEdit<ProjectItem, number>({
    getId: (row) => row.id,
    hasChanges: (original, draft) => (
      original.name !== draft.name
      || String(original.budget) !== String(draft.budget)
      || String(original.startDate ?? '') !== String(draft.startDate ?? '')
      || String(original.endDate ?? '') !== String(draft.endDate ?? '')
    ),
    selector: (id, field) => `[data-project-edit="${id}-${String(field)}"]`
  });
  const requirementEdit = useInlineEdit<Requirement, number>({
    getId: (row) => row.id,
    hasChanges: (original, draft) => (
      original.title !== draft.title
      || original.description !== draft.description
      || original.priority !== draft.priority
      || original.status !== draft.status
    ),
    selector: (id, field) => `[data-requirement-edit="${id}-${String(field)}"]`
  });
  const costEdit = useInlineEdit<CostEntryItem, number>({
    getId: (row) => row.id,
    hasChanges: (original, draft) => (
      original.type !== draft.type
      || String(original.amount) !== String(draft.amount)
      || original.occurredOn !== draft.occurredOn
      || String(original.note ?? '') !== String(draft.note ?? '')
    ),
    selector: (id, field) => `[data-cost-edit="${id}-${String(field)}"]`
  });
  const worklogEdit = useInlineEdit<Worklog, number>({
    getId: (row) => row.id,
    hasChanges: (original, draft) => (
      String(original.taskTitle ?? '') !== String(draft.taskTitle ?? '')
      || String(original.hours) !== String(draft.hours)
      || String(original.hourlyRate) !== String(draft.hourlyRate)
      || original.workedOn !== draft.workedOn
      || String(original.note ?? '') !== String(draft.note ?? '')
    ),
    selector: (id, field) => `[data-worklog-edit="${id}-${String(field)}"]`
  });
  const taskEdit = useInlineEdit<ScheduleData['tasks'][number], number>({
    getId: (row) => row.id,
    hasChanges: (original, draft) => (
      original.title !== draft.title
      || original.assignee !== draft.assignee
      || original.status !== draft.status
      || original.plannedStart !== draft.plannedStart
      || original.plannedEnd !== draft.plannedEnd
    ),
    selector: (id, field) => `[data-task-edit="${id}-${String(field)}"]`
  });
  const milestoneEdit = useInlineEdit<ScheduleData['milestones'][number], number>({
    getId: (row) => row.id,
    hasChanges: (original, draft) => (
      original.name !== draft.name
      || original.plannedDate !== draft.plannedDate
      || String(original.actualDate ?? '') !== String(draft.actualDate ?? '')
    ),
    selector: (id, field) => `[data-milestone-edit="${id}-${String(field)}"]`
  });

  function normalizeDateInput(value: unknown) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return '';
    }
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return '';
  }

  function getAssigneeName(value: unknown) {
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0] as any;
      if (typeof first?.name === 'string') return first.name;
      if (typeof first?.en_name === 'string') return first.en_name;
    }
    if (typeof value === 'string') return value;
    return '';
  }

  function extractAssigneeName(value: unknown) {
    return getAssigneeName(value);
  }

  function normalizeProgress(value: unknown) {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value.replace('%', '').trim();
    return '';
  }

  function resetFeishuForm() {
    setFeishuForm(FEISHU_DEFAULT_FORM);
    setFeishuEditingId(null);
  }

  function mapRecordToForm(record: FeishuRecord): FeishuFormState {
    const fields = (record.fields || {}) as Record<string, unknown>;
    return {
      任务ID: String(fields['任务ID'] ?? ''),
      任务名称: String(fields['任务名称'] ?? ''),
      状态: String(fields['状态'] ?? '待办'),
      优先级: String(fields['优先级'] ?? '中'),
      负责人: extractAssigneeName(fields['负责人']),
      开始时间: normalizeDateInput(fields['开始时间']),
      截止时间: normalizeDateInput(fields['截止时间']),
      进度: normalizeProgress(fields['进度']),
      所属项目: String(fields['所属项目'] ?? ''),
      是否阻塞: String(fields['是否阻塞'] ?? '否'),
      阻塞原因: String(fields['阻塞原因'] ?? ''),
      风险等级: String(fields['风险等级'] ?? '中')
    };
  }

  function buildFeishuFieldsPayload(form: FeishuFormState) {
    const payload: Record<string, unknown> = {
      任务ID: form.任务ID.trim(),
      任务名称: form.任务名称.trim(),
      状态: form.状态.trim(),
      优先级: form.优先级.trim(),
      负责人: form.负责人.trim(),
      所属项目: form.所属项目.trim(),
      是否阻塞: form.是否阻塞.trim(),
      阻塞原因: form.阻塞原因.trim(),
      风险等级: form.风险等级.trim()
    };

    const start = form.开始时间 ? new Date(form.开始时间).getTime() : null;
    const end = form.截止时间 ? new Date(form.截止时间).getTime() : null;
    payload['开始时间'] = Number.isFinite(start) ? start : null;
    payload['截止时间'] = Number.isFinite(end) ? end : null;

    const progress = Number(form.进度);
    payload['进度'] = Number.isFinite(progress) ? progress : null;
    return payload;
  }

  async function loadFeishuRecords(options?: { resetPage?: boolean }) {
    if (!token) return;
    setFeishuLoading(true);
    setFeishuError('');
    try {
      const pageToken = options?.resetPage ? undefined : feishuPageToken;
      if (options?.resetPage) {
        setFeishuPageStack([]);
      }
      const res = await listFeishuRecords({
        pageSize: feishuPageSize,
        pageToken,
        filter: feishuFilter || undefined,
        sort: feishuSort || undefined,
        fieldNames: FEISHU_FIELD_NAMES,
        search: feishuSearch || undefined,
        searchFields: feishuSearchFields || undefined,
        filterProject: feishuFilterProject || undefined,
        filterStatus: feishuFilterStatus || undefined,
        filterAssignee: feishuFilterAssignee || undefined,
        filterRisk: feishuFilterRisk || undefined
      });
      setFeishuRecords(res.items || []);
      setFeishuHasMore(Boolean(res.has_more));
      setFeishuNextToken(res.page_token);
      setFeishuPageToken(pageToken);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setFeishuError(`获取记录失败。（${detail}）`);
    } finally {
      setFeishuLoading(false);
    }
  }

  function startInlineFeishuEdit(record: FeishuRecord, field?: keyof FeishuFormState) {
    setFeishuEditingId(record.record_id);
    setFeishuRecordDraft((prev) => (feishuEditingId === record.record_id && prev ? prev : mapRecordToForm(record)));
    setFeishuEditingField(field ?? null);
    if (field) {
      setTimeout(() => {
        const el = document.querySelector(`[data-feishu-edit="${record.record_id}-${String(field)}"]`) as HTMLInputElement | null;
        el?.focus();
        el?.select();
      }, 0);
    }
  }

  function updateFeishuRecordDraft(field: keyof FeishuFormState, value: string) {
    setFeishuRecordDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value } as FeishuFormState;
    });
  }

  function hasFeishuRecordDraftChanges(original: FeishuFormState, draft: FeishuFormState | null) {
    if (!draft) return false;
    return Object.keys(original).some((key) => (original as any)[key] !== (draft as any)[key]);
  }

  function finalizeInlineFeishuEdit(original: FeishuRecord) {
    const originalForm = mapRecordToForm(original);
    if (!feishuRecordDraft) return;
    if (!hasFeishuRecordDraftChanges(originalForm, feishuRecordDraft)) {
      cancelInlineFeishuEdit();
      return;
    }
    setFeishuEditingField(null);
  }

  async function saveInlineFeishuEdit(original: FeishuRecord) {
    if (!feishuRecordDraft) return;
    const originalForm = mapRecordToForm(original);
    if (!hasFeishuRecordDraftChanges(originalForm, feishuRecordDraft)) return;
    setFeishuError('');
    setFeishuMessage('');
    try {
      const payload = buildFeishuFieldsPayload(feishuRecordDraft);
      await updateFeishuRecord(original.record_id, payload);
      setFeishuMessage('飞书记录已更新。');
      cancelInlineFeishuEdit();
      await loadFeishuRecords();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setFeishuError(`更新失败。（${detail}）`);
    }
  }

  function cancelInlineFeishuEdit() {
    setFeishuEditingId(null);
    setFeishuEditingField(null);
    setFeishuRecordDraft(null);
  }

  async function submitFeishuRecord(e: import('react').FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    setFeishuError('');
    setFeishuMessage('');
    try {
      const payload = buildFeishuFieldsPayload(feishuForm);
      if (feishuEditingId) {
        await updateFeishuRecord(feishuEditingId, payload);
        setFeishuMessage('飞书记录已更新。');
      } else {
        await createFeishuRecord(payload);
        setFeishuMessage('飞书记录已创建。');
      }
      resetFeishuForm();
      await loadFeishuRecords({ resetPage: true });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setFeishuError(`提交失败。（${detail}）`);
    }
  }

  async function removeFeishuRecord(record: FeishuRecord) {
    if (!canWrite) return;
    if (!window.confirm('确定删除该飞书记录？')) return;
    setFeishuError('');
    setFeishuMessage('');
    try {
      await deleteFeishuRecord(record.record_id);
      setFeishuMessage('飞书记录已删除。');
      await loadFeishuRecords();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setFeishuError(`删除失败。（${detail}）`);
    }
  }

  function goFeishuNextPage() {
    if (!feishuNextToken) return;
    setFeishuPageStack((prev) => [...prev, feishuPageToken || '']);
    setFeishuPageToken(feishuNextToken);
  }

  function goFeishuPrevPage() {
    setFeishuPageStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const token = next.pop();
      setFeishuPageToken(token || undefined);
      return next;
    });
  }

  function updateFeishuField(key: keyof FeishuFormState, value: string) {
    setFeishuForm((prev) => ({ ...prev, [key]: value }));
  }

  function formatFeishuValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) {
      const names = value
        .map((item) => {
          if (item && typeof item === 'object' && 'name' in item) return String((item as any).name);
          return formatFeishuValue(item);
        })
        .filter((item) => item && item !== '-');
      if (names.length > 0) return names.join(', ');
      return value.map((item) => formatFeishuValue(item)).join(', ');
    }
    if (typeof value === 'object') {
      if (value && 'name' in (value as any)) return String((value as any).name);
      return JSON.stringify(value);
    }
    return String(value);
  }

  const FEISHU_DATE_FIELDS: Array<keyof FeishuFormState> = ['开始时间', '截止时间'];

  function formatDateValue(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value < 100000000000) return null;
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return null;
    }
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      if (!value.includes('-') && !value.includes('T')) return null;
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return null;
    }
    return null;
  }

  function formatProgressValue(value: unknown) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number' && Number.isFinite(value)) {
      const num = value <= 1 ? value * 100 : value;
      return `${Math.round(num)}%`;
    }
    if (typeof value === 'string') {
      const trimmed = value.replace('%', '').trim();
      const num = Number(trimmed);
      if (Number.isFinite(num)) {
        const normalized = num <= 1 ? num * 100 : num;
        return `${Math.round(normalized)}%`;
      }
      return value;
    }
    return String(value);
  }

  useEffect(() => {
    if (token && view === 'feishu') {
      void loadFeishuRecords({ resetPage: true });
    }
  }, [token, view]);

  useEffect(() => {
    if (token && view === 'feishu') {
      void loadFeishuRecords();
    }
  }, [feishuPageToken]);


  const filteredFeishuRecords = feishuRecords;
  const feishuProjectOptions = Array.from(
    new Set(
      [
        ...projects.map((project) => project.name),
        ...feishuRecords.map((record) => String((record.fields || {})['所属项目'] ?? ''))
      ].filter((value) => value)
    )
  );

  if (!token) {

    return (
      <div className="app" style={{ gridTemplateColumns: '1fr' }}>
        <main className="main" style={{ maxWidth: 480, margin: '80px auto', width: '100%' }}>
          <h2><span style={{ color: 'var(--neon-blue)' }}>&lt;天枢系统&gt;</span> 统一认证网关</h2>
          <div className="card" style={{ marginTop: '30px', borderTop: '2px solid var(--neon-blue)' }}>
            <form className="form" style={{ gridTemplateColumns: '1fr' }} onSubmit={submitLogin}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 5, display: 'block' }}>[ 账号.凭据 ]</label>
                <input name="username" placeholder="pm / lead / viewer" required style={{ background: 'rgba(0,0,0,0.5)' }} />
              </div>
              <div style={{ marginTop: 5 }}>
                <label style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 5, display: 'block' }}>[ 登录.密钥 ]</label>
                <input name="password" type="password" placeholder="***" required style={{ background: 'rgba(0,0,0,0.5)' }} />
              </div>
              <button className="btn" type="submit" style={{ marginTop: '15px' }}>[ 初始化会话 ]</button>
            </form>
            {error && <p className="warn" style={{ marginTop: 15 }}>[错误]: {error}</p>}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 style={{ fontSize: '22px', letterSpacing: '2px' }}>天枢·全局管控矩阵</h1>
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>[ 系统看板 ]</button>
        <button className={view === 'requirements' ? 'active' : ''} onClick={() => setView('requirements')}>[ 需求管理 ]</button>
        <button className={view === 'costs' ? 'active' : ''} onClick={() => setView('costs')}>[ 成本监控 ]</button>
        <button className={view === 'schedule' ? 'active' : ''} onClick={() => setView('schedule')}>[ 进度同步 ]</button>
        <button className={view === 'notifications' ? 'active' : ''} onClick={() => setView('notifications')}>
          [ 系统预警 ]{notifications.filter((n) => !n.readAt).length > 0 ? ` [${notifications.filter((n) => !n.readAt).length}]` : ''}
        </button>
        {canWrite && <button className={view === 'audit' ? 'active' : ''} onClick={() => { setView('audit'); void loadAuditLogs(); }}>[ 审计日志 ]</button>}
        <button className={view === 'feishu' ? 'active' : ''} onClick={() => setView('feishu')}>[ 飞书记录 ]</button>
        <button className={view === 'ai' ? 'active' : ''} onClick={() => setView('ai')}>[ AI 驱动核心 ]</button>
      </aside>

      <main className="main">
        <div className="view-header" style={{ borderBottom: '1px solid var(--border-tech)', paddingBottom: '15px', marginBottom: '25px' }}>
          <h2>核心系统_看板 <span style={{ fontSize: 12, color: 'var(--neon-green)', border: '1px solid var(--neon-green)', padding: '2px 6px', borderRadius: 2, marginLeft: 10 }}>在线运转</span></h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'Orbitron', letterSpacing: 1 }}>
              &gt; 活动节点: {user?.name ?? 'UNKNOWN'}::{user?.role?.toUpperCase() ?? 'GUEST'}
            </span>
            <button className="btn" onClick={logout} style={{ padding: '6px 15px', fontSize: 11 }}>终止会话</button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 25, background: 'rgba(0,15,30,0.6)', borderLeft: '3px solid var(--neon-blue)' }}>
          <div className="form" style={{ gridTemplateColumns: 'minmax(200px, 300px)', alignItems: 'center' }}>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 5, display: 'block', fontFamily: 'Orbitron' }}>目标工作区</label>
              <select
                value={selectedProjectId ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    void refreshAll(null);
                    return;
                  }
                  void refreshAll(Number(value));
                }}
              >
                {projects.length === 0 && <option value="">暂无项目</option>}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} (#{project.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: 'var(--text-main)', marginTop: 15, borderTop: '1px solid rgba(0, 243, 255, 0.1)', paddingTop: 10 }}>
            <span style={{ color: 'var(--text-muted)', marginRight: 10 }}>当前项目：</span> <strong style={{ color: 'var(--neon-blue)', letterSpacing: 1 }}>{selectedProjectName}</strong>
          </div>
        </div>

        {loading && <p>Loading...</p>}
        {message && <p>{message}</p>}
        {error && <p className="warn">{error}</p>}
        {!canWrite && <p className="warn">当前角色为只读（viewer），新增与修改操作已禁用。</p>}

        {view === 'dashboard' && (
          <DashboardView
            canWrite={canWrite}
            overview={overview}
            projects={projects}
            selectedProjectIds={selectedProjectIds}
            onToggleProjectSelection={toggleProjectSelection}
            onDeleteSelectedProjects={() => void deleteSelectedProjects()}
            onSubmitProject={submitProject}
            onDeleteProject={(project) => void deleteProject(project)}
            projectEdit={projectEdit}
            onSaveProject={(project) => void saveInlineProjectEdit(project)}
            onInlineKeyDown={handleInlineKeyDown}
          />
        )}

        {view === 'requirements' && (
          <RequirementsView
            canWrite={canWrite}
            requirements={requirements}
            onSubmitRequirement={submitRequirement}
            requirementEdit={requirementEdit}
            onSaveRequirement={(req) => void saveInlineRequirementEdit(req)}
            onReviewRequirement={(id, decision) => void reviewRequirementAction(id, decision)}
            onMarkRequirementChanged={(req) => void markRequirementChanged(req)}
            onDeleteRequirement={(req) => void deleteRequirement(req)}
            onInlineKeyDown={handleInlineKeyDown}
          />
        )}

        {view === 'costs' && (
          <CostsView
            canWrite={canWrite}
            costSummary={costSummary}
            costEntries={costEntries}
            worklogs={worklogs}
            onSubmitCost={submitCost}
            onSubmitWorklog={submitWorklog}
            costEdit={costEdit}
            worklogEdit={worklogEdit}
            onSaveCost={(entry) => void saveInlineCostEdit(entry)}
            onSaveWorklog={(worklog) => void saveInlineWorklogEdit(worklog)}
            onDeleteCost={(entry) => void deleteCostEntry(entry)}
            onDeleteWorklog={(worklog) => void deleteWorklog(worklog)}
            onInlineKeyDown={handleInlineKeyDown}
          />
        )}

        {view === 'schedule' && (
          <ScheduleView
            canWrite={canWrite}
            schedule={schedule}
            riskText={riskText}
            onSubmitTask={submitTask}
            onSubmitMilestone={submitMilestone}
            taskEdit={taskEdit}
            milestoneEdit={milestoneEdit}
            onSaveTask={(task) => void saveInlineTaskEdit(task)}
            onSaveMilestone={(milestone) => void saveInlineMilestoneEdit(milestone)}
            onDeleteTask={(task) => void deleteTask(task)}
            onDeleteMilestone={(milestone) => void deleteMilestone(milestone)}
            onInlineKeyDown={handleInlineKeyDown}
          />
        )}

        {view === 'feishu' && (
          <FeishuView
            canWrite={canWrite}
            projects={projects}
            feishuForm={feishuForm}
            feishuMessage={feishuMessage}
            feishuError={feishuError}
            feishuLoading={feishuLoading}
            feishuRecords={feishuRecords}
            filteredFeishuRecords={filteredFeishuRecords}
            feishuProjectOptions={feishuProjectOptions}
            feishuSearch={feishuSearch}
            feishuSearchFields={feishuSearchFields}
            feishuFilterProject={feishuFilterProject}
            feishuFilterStatus={feishuFilterStatus}
            feishuFilterAssignee={feishuFilterAssignee}
            feishuFilterRisk={feishuFilterRisk}
            feishuPageSize={feishuPageSize}
            feishuHasMore={feishuHasMore}
            feishuPageStack={feishuPageStack}
            onUpdateFeishuField={updateFeishuField}
            onSubmitFeishu={submitFeishuRecord}
            onSetFeishuSearch={setFeishuSearch}
            onSetFeishuSearchFields={setFeishuSearchFields}
            onSetFeishuFilterProject={setFeishuFilterProject}
            onSetFeishuFilterStatus={setFeishuFilterStatus}
            onSetFeishuFilterAssignee={setFeishuFilterAssignee}
            onSetFeishuFilterRisk={setFeishuFilterRisk}
            onSetFeishuPageSize={setFeishuPageSize}
            onLoadFeishu={() => void loadFeishuRecords({ resetPage: true })}
            onPrevPage={goFeishuPrevPage}
            onNextPage={goFeishuNextPage}
            onRemoveFeishu={(record) => void removeFeishuRecord(record)}
            onStartInlineEdit={startInlineFeishuEdit}
            onUpdateRecordDraft={updateFeishuRecordDraft}
            onFinalizeInlineEdit={finalizeInlineFeishuEdit}
            onSaveInlineEdit={(record) => void saveInlineFeishuEdit(record)}
            onCancelInlineEdit={cancelInlineFeishuEdit}
            onInlineKeyDown={handleInlineKeyDown}
            feishuEditingId={feishuEditingId}
            feishuEditingField={feishuEditingField}
            feishuRecordDraft={feishuRecordDraft}
            onHasDraftChanges={hasFeishuRecordDraftChanges}
            onMapRecordToForm={mapRecordToForm}
            formatFeishuValue={formatFeishuValue}
            formatDateValue={formatDateValue}
            formatProgressValue={formatProgressValue}
            getAssigneeName={getAssigneeName}
          />
        )}

        {view === 'ai' && (
          <AiView aiReport={aiReport} onGenerate={generateReport} />
        )}

        {view === 'notifications' && (
          <NotificationsView notifications={notifications} onMarkRead={(id) => void markNotificationRead(id)} />
        )}

        {view === 'audit' && canWrite && (
          <AuditView auditLogs={auditLogs} />
        )}
      </main>
    </div>
  );
}

export default App;
