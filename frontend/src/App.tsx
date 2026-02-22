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

type ViewKey = 'dashboard' | 'requirements' | 'costs' | 'schedule' | 'ai' | 'notifications' | 'audit' | 'feishu';

type FeishuFormState = {
  任务ID: string;
  任务名称: string;
  状态: string;
  优先级: string;
  负责人: string;
  开始时间: string;
  截止时间: string;
  进度: string;
  所属项目: string;
  是否阻塞: string;
  阻塞原因: string;
  风险等级: string;
};

const FEISHU_FIELDS: Array<{ key: keyof FeishuFormState; label: string; type: 'text' | 'select' | 'date' | 'number'; options?: string[]; required?: boolean }> = [
  { key: '任务ID', label: '任务ID', type: 'text', required: true },
  { key: '任务名称', label: '任务名称', type: 'text', required: true },
  { key: '状态', label: '状态', type: 'select', options: ['待办', '进行中', '已完成'], required: true },
  { key: '优先级', label: '优先级', type: 'select', options: ['低', '中', '高'], required: true },
  { key: '负责人', label: '负责人(姓名)', type: 'text', required: true },
  { key: '开始时间', label: '开始时间', type: 'date' },
  { key: '截止时间', label: '截止时间', type: 'date' },
  { key: '进度', label: '进度(0-100)', type: 'number' },
  { key: '所属项目', label: '所属项目', type: 'select' },
  { key: '是否阻塞', label: '是否阻塞', type: 'select', options: ['是', '否'], required: true },
  { key: '阻塞原因', label: '阻塞原因', type: 'text' },
  { key: '风险等级', label: '风险等级', type: 'select', options: ['低', '中', '高'], required: true }
];

const FEISHU_FIELD_NAMES = FEISHU_FIELDS.map((item) => item.key).join(',');

const FEISHU_DEFAULT_FORM: FeishuFormState = {
  任务ID: '',
  任务名称: '',
  状态: '待办',
  优先级: '中',
  负责人: '',
  开始时间: '',
  截止时间: '',
  进度: '',
  所属项目: '',
  是否阻塞: '否',
  阻塞原因: '',
  风险等级: '中'
};


interface DashboardOverview {
  summary: { projectCount: number; requirementCount: number; riskProjectCount: number };
  projects: Array<{
    projectId: number;
    projectName: string;
    healthScore: number;
    varianceRate: number;
    blockedTasks: number;
    requirementCount: number;
  }>;
}

interface Requirement {
  id: number;
  projectId: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  changeCount: number;
}

interface CostSummary {
  projectId: number;
  budget: number;
  actual: number;
  varianceRate: number;
  byType: { labor: number; outsource: number; cloud: number };
}

interface ScheduleData {
  tasks: Array<{ id: number; title: string; assignee: string; status: string; plannedStart: string; plannedEnd: string }>;
  milestones: Array<{ id: number; name: string; plannedDate: string; actualDate?: string | null }>;
}

interface RiskData {
  projectId: number;
  blockedCount: number;
  inProgressCount: number;
  riskLevel: string;
}

interface ProjectItem {
  id: number;
  name: string;
  budget: number;
  startDate?: string | null;
  endDate?: string | null;
}

interface CostEntryItem {
  id: number;
  projectId: number;
  type: 'labor' | 'outsource' | 'cloud';
  amount: number;
  occurredOn: string;
  note?: string | null;
}

interface Worklog {
  id: number;
  projectId: number;
  userId?: number;
  taskTitle?: string;
  hours: number;
  hourlyRate: number;
  workedOn: string;
  note?: string;
}

interface NotificationItem {
  id: number;
  projectId?: number;
  level: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
}

interface AuditLogItem {
  id: number;
  userName?: string;
  userRole?: string;
  method: string;
  path: string;
  projectId?: number;
  createdAt: string;
}

interface AuthUser {
  id: number;
  name: string;
  role: string;
}

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
          <div>
            {canWrite && (
              <form className="form" onSubmit={submitProject} style={{ marginBottom: 12 }}>
                <input name="name" placeholder="项目名称" required />
                <input name="budget" type="number" step="0.01" placeholder="预算" required />
                <input name="startDate" type="date" />
                <input name="endDate" type="date" />
                <button className="btn" type="submit">新增项目</button>
              </form>
            )}
            <div className="grid">
              <div className="card"><h3>项目数</h3><p>{overview?.summary.projectCount ?? 0}</p></div>
              <div className="card"><h3>需求数</h3><p>{overview?.summary.requirementCount ?? 0}</p></div>
              <div className="card"><h3>高风险项目</h3><p className="warn">{overview?.summary.riskProjectCount ?? 0}</p></div>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>项目管理</h3>
                {canWrite && (
                  <button className="btn" type="button" disabled={selectedProjectIds.length === 0} onClick={() => void deleteSelectedProjects()}>
                    批量删除 ({selectedProjectIds.length})
                  </button>
                )}
              </div>
              <table className="table">
                <thead>
                  <tr>
                    {canWrite && (
                      <th>
                        <input
                          type="checkbox"
                          checked={projects.length > 0 && selectedProjectIds.length === projects.length}
                          onChange={(e) => setSelectedProjectIds(e.target.checked ? projects.map((item) => item.id) : [])}
                        />
                      </th>
                    )}
                    <th>ID</th>
                    <th>名称</th>
                    <th>预算</th>
                    <th>开始</th>
                    <th>结束</th>
                    {canWrite && <th>操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    (() => {
                      const isEditing = projectEdit.editingId === project.id;
                      const rowDraft = isEditing ? (projectEdit.draft ?? project) : project;
                      const isDirty = isEditing && projectEdit.hasDirty(project);
                      return (
                        <tr key={project.id} className={isEditing ? 'editing-row' : ''}>
                          {canWrite && (
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedProjectIds.includes(project.id)}
                                onChange={(e) => toggleProjectSelection(project.id, e.target.checked)}
                              />
                            </td>
                          )}
                          <td>{project.id}</td>
                          <td
                            className={isEditing && projectEdit.editingField === 'name' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'name')}
                          >
                            {isEditing && projectEdit.editingField === 'name' ? (
                              <input
                                data-project-edit={`${project.id}-name`}
                                value={rowDraft.name ?? ''}
                                onChange={(e) => projectEdit.updateDraft('name', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineProjectEdit(project), projectEdit.cancel)}
                                onBlur={() => projectEdit.finalize(project)}
                              />
                            ) : (
                              rowDraft.name
                            )}
                          </td>
                          <td
                            className={isEditing && projectEdit.editingField === 'budget' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'budget')}
                          >
                            {isEditing && projectEdit.editingField === 'budget' ? (
                              <input
                                data-project-edit={`${project.id}-budget`}
                                type="number"
                                step="0.01"
                                value={rowDraft.budget ?? ''}
                                onChange={(e) => projectEdit.updateDraft('budget', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineProjectEdit(project), projectEdit.cancel)}
                                onBlur={() => projectEdit.finalize(project)}
                              />
                            ) : (
                              rowDraft.budget
                            )}
                          </td>
                          <td
                            className={isEditing && projectEdit.editingField === 'startDate' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'startDate')}
                          >
                            {isEditing && projectEdit.editingField === 'startDate' ? (
                              <input
                                data-project-edit={`${project.id}-startDate`}
                                type="date"
                                value={rowDraft.startDate ?? ''}
                                onChange={(e) => projectEdit.updateDraft('startDate', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineProjectEdit(project), projectEdit.cancel)}
                                onBlur={() => projectEdit.finalize(project)}
                              />
                            ) : (
                              rowDraft.startDate || '-'
                            )}
                          </td>
                          <td
                            className={isEditing && projectEdit.editingField === 'endDate' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'endDate')}
                          >
                            {isEditing && projectEdit.editingField === 'endDate' ? (
                              <input
                                data-project-edit={`${project.id}-endDate`}
                                type="date"
                                value={rowDraft.endDate ?? ''}
                                onChange={(e) => projectEdit.updateDraft('endDate', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineProjectEdit(project), projectEdit.cancel)}
                                onBlur={() => projectEdit.finalize(project)}
                              />
                            ) : (
                              rowDraft.endDate || '-'
                            )}
                          </td>
                          {canWrite && (
                            <td style={{ display: 'flex', gap: 6 }}>
                              {isEditing && isDirty ? (
                                <>
                                  <button className="btn" type="button" disabled={!isDirty} onClick={() => void saveInlineProjectEdit(project)}>保存</button>
                                  <button className="btn" type="button" onClick={projectEdit.cancel}>取消</button>
                                </>
                              ) : (
                                <button className="btn" type="button" onClick={() => void deleteProject(project)}>删除</button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <h3>项目健康度</h3>
              <table className="table">
                <thead><tr><th>项目</th><th>健康度</th><th>预算偏差%</th><th>阻塞任务</th><th>需求数</th></tr></thead>
                <tbody>
                  {overview?.projects.map((p) => (
                    <tr key={p.projectId}>
                      <td>{p.projectName}</td><td>{p.healthScore}</td><td>{p.varianceRate}</td><td>{p.blockedTasks}</td><td>{p.requirementCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'requirements' && (
          <div>
            {canWrite && (
              <form className="form" onSubmit={submitRequirement}>
                <input name="title" placeholder="需求标题" required />
                <select name="priority" defaultValue="medium"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
                <input name="description" placeholder="需求描述" required />
                <button className="btn" type="submit">新增需求</button>
              </form>
            )}
            <div className="card" style={{ marginTop: 12 }}>
              <table className="table">
                <thead><tr><th>ID</th><th>标题</th><th>描述</th><th>优先级</th><th>状态</th><th>变更次数</th>{canWrite && <th>操作</th>}</tr></thead>
                <tbody>
                  {requirements.map((r) => (
                    (() => {
                      const isEditing = requirementEdit.editingId === r.id;
                      const rowDraft = isEditing ? (requirementEdit.draft ?? r) : r;
                      const isDirty = isEditing && requirementEdit.hasDirty(r);
                      return (
                        <tr key={r.id} className={isEditing ? 'editing-row' : ''}>
                          <td>{r.id}</td>
                          <td
                            className={isEditing && requirementEdit.editingField === 'title' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && requirementEdit.startEdit(r, 'title')}
                          >
                            {isEditing && requirementEdit.editingField === 'title' ? (
                              <input
                                data-requirement-edit={`${r.id}-title`}
                                value={rowDraft.title ?? ''}
                                onChange={(e) => requirementEdit.updateDraft('title', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineRequirementEdit(r), requirementEdit.cancel)}
                                onBlur={() => requirementEdit.finalize(r)}
                              />
                            ) : (
                              rowDraft.title
                            )}
                          </td>
                          <td
                            className={isEditing && requirementEdit.editingField === 'description' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && requirementEdit.startEdit(r, 'description')}
                          >
                            {isEditing && requirementEdit.editingField === 'description' ? (
                              <input
                                data-requirement-edit={`${r.id}-description`}
                                value={rowDraft.description ?? ''}
                                onChange={(e) => requirementEdit.updateDraft('description', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineRequirementEdit(r), requirementEdit.cancel)}
                                onBlur={() => requirementEdit.finalize(r)}
                              />
                            ) : (
                              rowDraft.description
                            )}
                          </td>
                          <td
                            className={isEditing && requirementEdit.editingField === 'priority' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && requirementEdit.startEdit(r, 'priority')}
                          >
                            {isEditing && requirementEdit.editingField === 'priority' ? (
                              <select
                                data-requirement-edit={`${r.id}-priority`}
                                value={rowDraft.priority ?? 'medium'}
                                onChange={(e) => requirementEdit.updateDraft('priority', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineRequirementEdit(r), requirementEdit.cancel)}
                                onBlur={() => requirementEdit.finalize(r)}
                              >
                                {['low', 'medium', 'high'].map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              rowDraft.priority
                            )}
                          </td>
                          <td
                            className={isEditing && requirementEdit.editingField === 'status' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && requirementEdit.startEdit(r, 'status')}
                          >
                            {isEditing && requirementEdit.editingField === 'status' ? (
                              <select
                                data-requirement-edit={`${r.id}-status`}
                                value={rowDraft.status ?? 'draft'}
                                onChange={(e) => requirementEdit.updateDraft('status', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineRequirementEdit(r), requirementEdit.cancel)}
                                onBlur={() => requirementEdit.finalize(r)}
                              >
                                {['draft', 'in_review', 'approved', 'planned', 'done'].map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              rowDraft.status
                            )}
                          </td>
                          <td>{r.changeCount}</td>
                          {canWrite && (
                            <td style={{ display: 'flex', gap: 6 }}>
                              {isEditing && isDirty ? (
                                <>
                                  <button className="btn" type="button" disabled={!isDirty} onClick={() => void saveInlineRequirementEdit(r)}>保存</button>
                                  <button className="btn" type="button" onClick={requirementEdit.cancel}>取消</button>
                                </>
                              ) : (
                                <>
                                  <button className="btn" type="button" onClick={() => void reviewRequirementAction(r.id, 'approved')}>通过</button>
                                  <button className="btn" type="button" onClick={() => void reviewRequirementAction(r.id, 'rejected')}>驳回</button>
                                  <button className="btn" type="button" onClick={() => void markRequirementChanged(r)}>记变更</button>
                                  <button className="btn" type="button" onClick={() => void deleteRequirement(r)}>删除</button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'costs' && (
          <div>
            {canWrite && (
              <>
                <form className="form" onSubmit={submitCost}>
                  <select name="type" defaultValue="labor"><option value="labor">labor</option><option value="outsource">outsource</option><option value="cloud">cloud</option></select>
                  <input name="amount" type="number" step="0.01" placeholder="金额" required />
                  <input name="occurredOn" type="date" required />
                  <input name="note" placeholder="备注" />
                  <button className="btn" type="submit">新增成本</button>
                </form>
                <form className="form" onSubmit={submitWorklog} style={{ marginTop: 10 }}>
                  <input name="taskTitle" placeholder="工时任务" required />
                  <input name="hours" type="number" step="0.5" placeholder="工时(小时)" required />
                  <input name="hourlyRate" type="number" step="0.01" placeholder="时薪" required />
                  <input name="workedOn" type="date" required />
                  <input name="note" placeholder="备注" />
                  <button className="btn" type="submit">新增工时</button>
                </form>
              </>
            )}
            <div className="grid" style={{ marginTop: 12 }}>
              <div className="card"><h3>预算</h3><p>{costSummary?.budget ?? 0}</p></div>
              <div className="card"><h3>实际</h3><p>{costSummary?.actual ?? 0}</p></div>
              <div className="card"><h3>偏差%</h3><p className={costSummary && costSummary.varianceRate > 10 ? 'warn' : ''}>{costSummary?.varianceRate ?? 0}</p></div>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <h3>成本条目</h3>
              <table className="table">
                <thead><tr><th>ID</th><th>类型</th><th>金额</th><th>日期</th><th>备注</th>{canWrite && <th>操作</th>}</tr></thead>
                <tbody>
                  {costEntries.map((entry) => (
                    (() => {
                      const isEditing = costEdit.editingId === entry.id;
                      const rowDraft = isEditing ? (costEdit.draft ?? entry) : entry;
                      const isDirty = isEditing && costEdit.hasDirty(entry);
                      return (
                        <tr key={entry.id} className={isEditing ? 'editing-row' : ''}>
                          <td>{entry.id}</td>
                          <td
                            className={isEditing && costEdit.editingField === 'type' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && costEdit.startEdit(entry, 'type')}
                          >
                            {isEditing && costEdit.editingField === 'type' ? (
                              <select
                                data-cost-edit={`${entry.id}-type`}
                                value={rowDraft.type ?? 'labor'}
                                onChange={(e) => costEdit.updateDraft('type', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineCostEdit(entry), costEdit.cancel)}
                                onBlur={() => costEdit.finalize(entry)}
                              >
                                {['labor', 'outsource', 'cloud'].map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              rowDraft.type
                            )}
                          </td>
                          <td
                            className={isEditing && costEdit.editingField === 'amount' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && costEdit.startEdit(entry, 'amount')}
                          >
                            {isEditing && costEdit.editingField === 'amount' ? (
                              <input
                                data-cost-edit={`${entry.id}-amount`}
                                type="number"
                                step="0.01"
                                value={rowDraft.amount ?? ''}
                                onChange={(e) => costEdit.updateDraft('amount', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineCostEdit(entry), costEdit.cancel)}
                                onBlur={() => costEdit.finalize(entry)}
                              />
                            ) : (
                              rowDraft.amount
                            )}
                          </td>
                          <td
                            className={isEditing && costEdit.editingField === 'occurredOn' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && costEdit.startEdit(entry, 'occurredOn')}
                          >
                            {isEditing && costEdit.editingField === 'occurredOn' ? (
                              <input
                                data-cost-edit={`${entry.id}-occurredOn`}
                                type="date"
                                value={rowDraft.occurredOn ?? ''}
                                onChange={(e) => costEdit.updateDraft('occurredOn', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineCostEdit(entry), costEdit.cancel)}
                                onBlur={() => costEdit.finalize(entry)}
                              />
                            ) : (
                              rowDraft.occurredOn
                            )}
                          </td>
                          <td
                            className={isEditing && costEdit.editingField === 'note' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && costEdit.startEdit(entry, 'note')}
                          >
                            {isEditing && costEdit.editingField === 'note' ? (
                              <input
                                data-cost-edit={`${entry.id}-note`}
                                value={rowDraft.note ?? ''}
                                onChange={(e) => costEdit.updateDraft('note', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineCostEdit(entry), costEdit.cancel)}
                                onBlur={() => costEdit.finalize(entry)}
                              />
                            ) : (
                              rowDraft.note || '-'
                            )}
                          </td>
                          {canWrite && (
                            <td style={{ display: 'flex', gap: 6 }}>
                              {isEditing && isDirty ? (
                                <>
                                  <button className="btn" type="button" disabled={!isDirty} onClick={() => void saveInlineCostEdit(entry)}>保存</button>
                                  <button className="btn" type="button" onClick={costEdit.cancel}>取消</button>
                                </>
                              ) : (
                                <button className="btn" type="button" onClick={() => void deleteCostEntry(entry)}>删除</button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <h3>工时明细</h3>
              <table className="table">
                <thead><tr><th>日期</th><th>任务</th><th>工时</th><th>时薪</th><th>成本</th><th>备注</th>{canWrite && <th>操作</th>}</tr></thead>
                <tbody>
                  {worklogs.map((w) => (
                    (() => {
                      const isEditing = worklogEdit.editingId === w.id;
                      const rowDraft = isEditing ? (worklogEdit.draft ?? w) : w;
                      const isDirty = isEditing && worklogEdit.hasDirty(w);
                      const hours = Number(rowDraft.hours);
                      const hourlyRate = Number(rowDraft.hourlyRate);
                      const cost = Number.isFinite(hours) && Number.isFinite(hourlyRate) ? (hours * hourlyRate).toFixed(2) : '-';
                      return (
                        <tr key={w.id} className={isEditing ? 'editing-row' : ''}>
                          <td
                            className={isEditing && worklogEdit.editingField === 'workedOn' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'workedOn')}
                          >
                            {isEditing && worklogEdit.editingField === 'workedOn' ? (
                              <input
                                data-worklog-edit={`${w.id}-workedOn`}
                                type="date"
                                value={rowDraft.workedOn ?? ''}
                                onChange={(e) => worklogEdit.updateDraft('workedOn', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineWorklogEdit(w), worklogEdit.cancel)}
                                onBlur={() => worklogEdit.finalize(w)}
                              />
                            ) : (
                              rowDraft.workedOn
                            )}
                          </td>
                          <td
                            className={isEditing && worklogEdit.editingField === 'taskTitle' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'taskTitle')}
                          >
                            {isEditing && worklogEdit.editingField === 'taskTitle' ? (
                              <input
                                data-worklog-edit={`${w.id}-taskTitle`}
                                value={rowDraft.taskTitle ?? ''}
                                onChange={(e) => worklogEdit.updateDraft('taskTitle', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineWorklogEdit(w), worklogEdit.cancel)}
                                onBlur={() => worklogEdit.finalize(w)}
                              />
                            ) : (
                              rowDraft.taskTitle || '-'
                            )}
                          </td>
                          <td
                            className={isEditing && worklogEdit.editingField === 'hours' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'hours')}
                          >
                            {isEditing && worklogEdit.editingField === 'hours' ? (
                              <input
                                data-worklog-edit={`${w.id}-hours`}
                                type="number"
                                step="0.5"
                                value={rowDraft.hours ?? ''}
                                onChange={(e) => worklogEdit.updateDraft('hours', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineWorklogEdit(w), worklogEdit.cancel)}
                                onBlur={() => worklogEdit.finalize(w)}
                              />
                            ) : (
                              rowDraft.hours
                            )}
                          </td>
                          <td
                            className={isEditing && worklogEdit.editingField === 'hourlyRate' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'hourlyRate')}
                          >
                            {isEditing && worklogEdit.editingField === 'hourlyRate' ? (
                              <input
                                data-worklog-edit={`${w.id}-hourlyRate`}
                                type="number"
                                step="0.01"
                                value={rowDraft.hourlyRate ?? ''}
                                onChange={(e) => worklogEdit.updateDraft('hourlyRate', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineWorklogEdit(w), worklogEdit.cancel)}
                                onBlur={() => worklogEdit.finalize(w)}
                              />
                            ) : (
                              rowDraft.hourlyRate
                            )}
                          </td>
                          <td>{cost}</td>
                          <td
                            className={isEditing && worklogEdit.editingField === 'note' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'note')}
                          >
                            {isEditing && worklogEdit.editingField === 'note' ? (
                              <input
                                data-worklog-edit={`${w.id}-note`}
                                value={rowDraft.note ?? ''}
                                onChange={(e) => worklogEdit.updateDraft('note', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineWorklogEdit(w), worklogEdit.cancel)}
                                onBlur={() => worklogEdit.finalize(w)}
                              />
                            ) : (
                              rowDraft.note || '-'
                            )}
                          </td>
                          {canWrite && (
                            <td style={{ display: 'flex', gap: 6 }}>
                              {isEditing && isDirty ? (
                                <>
                                  <button className="btn" type="button" disabled={!isDirty} onClick={() => void saveInlineWorklogEdit(w)}>保存</button>
                                  <button className="btn" type="button" onClick={worklogEdit.cancel}>取消</button>
                                </>
                              ) : (
                                <button className="btn" type="button" onClick={() => void deleteWorklog(w)}>删除</button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'schedule' && (
          <div>
            {canWrite && (
              <>
                <form className="form" onSubmit={submitTask}>
                  <input name="title" placeholder="任务标题" required />
                  <input name="assignee" placeholder="负责人" required />
                  <select name="status" defaultValue="todo"><option value="todo">todo</option><option value="in_progress">in_progress</option><option value="blocked">blocked</option><option value="done">done</option></select>
                  <input name="plannedStart" type="date" required />
                  <input name="plannedEnd" type="date" required />
                  <button className="btn" type="submit">新增任务</button>
                </form>
                <form className="form" onSubmit={submitMilestone} style={{ marginTop: 10 }}>
                  <input name="name" placeholder="里程碑名称" required />
                  <input name="plannedDate" type="date" required />
                  <button className="btn" type="submit">新增里程碑</button>
                </form>
              </>
            )}
            <div className="card" style={{ marginTop: 12 }}>
              <h3>风险等级: {riskText}</h3>
              <table className="table">
                <thead><tr><th>任务</th><th>负责人</th><th>状态</th><th>计划开始</th><th>计划结束</th>{canWrite && <th>操作</th>}</tr></thead>
                <tbody>
                  {schedule?.tasks.map((t) => (
                    (() => {
                      const isEditing = taskEdit.editingId === t.id;
                      const rowDraft = isEditing ? (taskEdit.draft ?? t) : t;
                      const isDirty = isEditing && taskEdit.hasDirty(t);
                      return (
                        <tr key={t.id} className={isEditing ? 'editing-row' : ''}>
                          <td
                            className={isEditing && taskEdit.editingField === 'title' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && taskEdit.startEdit(t, 'title')}
                          >
                            {isEditing && taskEdit.editingField === 'title' ? (
                              <input
                                data-task-edit={`${t.id}-title`}
                                value={rowDraft.title ?? ''}
                                onChange={(e) => taskEdit.updateDraft('title', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineTaskEdit(t), taskEdit.cancel)}
                                onBlur={() => taskEdit.finalize(t)}
                              />
                            ) : (
                              rowDraft.title
                            )}
                          </td>
                          <td
                            className={isEditing && taskEdit.editingField === 'assignee' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && taskEdit.startEdit(t, 'assignee')}
                          >
                            {isEditing && taskEdit.editingField === 'assignee' ? (
                              <input
                                data-task-edit={`${t.id}-assignee`}
                                value={rowDraft.assignee ?? ''}
                                onChange={(e) => taskEdit.updateDraft('assignee', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineTaskEdit(t), taskEdit.cancel)}
                                onBlur={() => taskEdit.finalize(t)}
                              />
                            ) : (
                              rowDraft.assignee
                            )}
                          </td>
                          <td
                            className={isEditing && taskEdit.editingField === 'status' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && taskEdit.startEdit(t, 'status')}
                          >
                            {isEditing && taskEdit.editingField === 'status' ? (
                              <select
                                data-task-edit={`${t.id}-status`}
                                value={rowDraft.status ?? 'todo'}
                                onChange={(e) => taskEdit.updateDraft('status', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineTaskEdit(t), taskEdit.cancel)}
                                onBlur={() => taskEdit.finalize(t)}
                              >
                                {['todo', 'in_progress', 'blocked', 'done'].map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              rowDraft.status
                            )}
                          </td>
                          <td
                            className={isEditing && taskEdit.editingField === 'plannedStart' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && taskEdit.startEdit(t, 'plannedStart')}
                          >
                            {isEditing && taskEdit.editingField === 'plannedStart' ? (
                              <input
                                data-task-edit={`${t.id}-plannedStart`}
                                type="date"
                                value={rowDraft.plannedStart ?? ''}
                                onChange={(e) => taskEdit.updateDraft('plannedStart', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineTaskEdit(t), taskEdit.cancel)}
                                onBlur={() => taskEdit.finalize(t)}
                              />
                            ) : (
                              rowDraft.plannedStart
                            )}
                          </td>
                          <td
                            className={isEditing && taskEdit.editingField === 'plannedEnd' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && taskEdit.startEdit(t, 'plannedEnd')}
                          >
                            {isEditing && taskEdit.editingField === 'plannedEnd' ? (
                              <input
                                data-task-edit={`${t.id}-plannedEnd`}
                                type="date"
                                value={rowDraft.plannedEnd ?? ''}
                                onChange={(e) => taskEdit.updateDraft('plannedEnd', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineTaskEdit(t), taskEdit.cancel)}
                                onBlur={() => taskEdit.finalize(t)}
                              />
                            ) : (
                              rowDraft.plannedEnd
                            )}
                          </td>
                          {canWrite && (
                            <td style={{ display: 'flex', gap: 6 }}>
                              {isEditing && isDirty ? (
                                <>
                                  <button className="btn" type="button" disabled={!isDirty} onClick={() => void saveInlineTaskEdit(t)}>保存</button>
                                  <button className="btn" type="button" onClick={taskEdit.cancel}>取消</button>
                                </>
                              ) : (
                                <button className="btn" type="button" onClick={() => void deleteTask(t)}>删除</button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <h3>里程碑</h3>
              <table className="table">
                <thead><tr><th>名称</th><th>计划日期</th><th>实际日期</th>{canWrite && <th>操作</th>}</tr></thead>
                <tbody>
                  {schedule?.milestones.map((m) => (
                    (() => {
                      const isEditing = milestoneEdit.editingId === m.id;
                      const rowDraft = isEditing ? (milestoneEdit.draft ?? m) : m;
                      const isDirty = isEditing && milestoneEdit.hasDirty(m);
                      return (
                        <tr key={m.id} className={isEditing ? 'editing-row' : ''}>
                          <td
                            className={isEditing && milestoneEdit.editingField === 'name' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && milestoneEdit.startEdit(m, 'name')}
                          >
                            {isEditing && milestoneEdit.editingField === 'name' ? (
                              <input
                                data-milestone-edit={`${m.id}-name`}
                                value={rowDraft.name ?? ''}
                                onChange={(e) => milestoneEdit.updateDraft('name', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineMilestoneEdit(m), milestoneEdit.cancel)}
                                onBlur={() => milestoneEdit.finalize(m)}
                              />
                            ) : (
                              rowDraft.name
                            )}
                          </td>
                          <td
                            className={isEditing && milestoneEdit.editingField === 'plannedDate' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && milestoneEdit.startEdit(m, 'plannedDate')}
                          >
                            {isEditing && milestoneEdit.editingField === 'plannedDate' ? (
                              <input
                                data-milestone-edit={`${m.id}-plannedDate`}
                                type="date"
                                value={rowDraft.plannedDate ?? ''}
                                onChange={(e) => milestoneEdit.updateDraft('plannedDate', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineMilestoneEdit(m), milestoneEdit.cancel)}
                                onBlur={() => milestoneEdit.finalize(m)}
                              />
                            ) : (
                              rowDraft.plannedDate
                            )}
                          </td>
                          <td
                            className={isEditing && milestoneEdit.editingField === 'actualDate' ? 'editing' : ''}
                            onDoubleClick={() => canWrite && milestoneEdit.startEdit(m, 'actualDate')}
                          >
                            {isEditing && milestoneEdit.editingField === 'actualDate' ? (
                              <input
                                data-milestone-edit={`${m.id}-actualDate`}
                                type="date"
                                value={rowDraft.actualDate ?? ''}
                                onChange={(e) => milestoneEdit.updateDraft('actualDate', e.target.value)}
                                onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineMilestoneEdit(m), milestoneEdit.cancel)}
                                onBlur={() => milestoneEdit.finalize(m)}
                              />
                            ) : (
                              rowDraft.actualDate || '-'
                            )}
                          </td>
                          {canWrite && (
                            <td style={{ display: 'flex', gap: 6 }}>
                              {isEditing && isDirty ? (
                                <>
                                  <button className="btn" type="button" disabled={!isDirty} onClick={() => void saveInlineMilestoneEdit(m)}>保存</button>
                                  <button className="btn" type="button" onClick={milestoneEdit.cancel}>取消</button>
                                </>
                              ) : (
                                <button className="btn" type="button" onClick={() => void deleteMilestone(m)}>删除</button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'feishu' && (
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <h3>飞书多维表格</h3>
              {canWrite && (
                <form className="form" onSubmit={submitFeishuRecord} style={{ marginTop: 8 }}>
                  {FEISHU_FIELDS.map((field) => {
                    const value = feishuForm[field.key] ?? '';
                    const options = field.key === '所属项目'
                      ? feishuProjectOptions
                      : field.options ?? [];
                    if (field.type === 'select') {
                      return (
                        <select
                          key={String(field.key)}
                          value={value}
                          onChange={(e) => updateFeishuField(field.key, e.target.value)}
                          required={field.required}
                        >
                          {!value && <option value="">请选择{field.label}</option>}
                          {options.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <input
                        key={String(field.key)}
                        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                        value={value}
                        placeholder={field.label}
                        required={field.required}
                        onChange={(e) => updateFeishuField(field.key, e.target.value)}
                      />
                    );
                  })}
                  <button className="btn" type="submit">提交记录</button>
                </form>
              )}
              {!canWrite && <p className="warn">当前角色为只读（viewer），新增与修改操作已禁用。</p>}
              {feishuMessage && <p>{feishuMessage}</p>}
              {feishuError && <p className="warn">{feishuError}</p>}
            </div>

            <div className="card">
              <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 8 }}>
                <input
                  placeholder="搜索关键词"
                  value={feishuSearch}
                  onChange={(e) => setFeishuSearch(e.target.value)}
                />
                <input
                  placeholder="搜索字段(逗号分隔)"
                  value={feishuSearchFields}
                  onChange={(e) => setFeishuSearchFields(e.target.value)}
                />
                <select value={feishuFilterProject} onChange={(e) => setFeishuFilterProject(e.target.value)}>
                  <option value="">所属项目(全部)</option>
                  {feishuProjectOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <select value={feishuFilterStatus} onChange={(e) => setFeishuFilterStatus(e.target.value)}>
                  <option value="">状态(全部)</option>
                  {['待办', '进行中', '已完成'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <input
                  placeholder="负责人(包含匹配)"
                  value={feishuFilterAssignee}
                  onChange={(e) => setFeishuFilterAssignee(e.target.value)}
                />
                <select value={feishuFilterRisk} onChange={(e) => setFeishuFilterRisk(e.target.value)}>
                  <option value="">风险等级(全部)</option>
                  {['低', '中', '高'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <select value={feishuPageSize} onChange={(e) => setFeishuPageSize(Number(e.target.value))}>
                  {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>每页 {size}</option>
                  ))}
                </select>
                <button className="btn" type="button" onClick={() => void loadFeishuRecords({ resetPage: true })}>查询/刷新</button>
              </div>

              {feishuLoading && <p>Loading...</p>}
              <table className="table table-wrap">
                <thead>
                  <tr>
                    {FEISHU_FIELDS.map((field) => (
                      <th key={String(field.key)}>{field.label}</th>
                    ))}
                    {canWrite && <th>操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredFeishuRecords.map((record) => {
                    const fields = (record.fields || {}) as Record<string, unknown>;
                    const originalForm = mapRecordToForm(record);
                    const isEditing = feishuEditingId === record.record_id;
                    const rowDraft = isEditing ? (feishuRecordDraft ?? originalForm) : originalForm;
                    const isDirty = isEditing && hasFeishuRecordDraftChanges(originalForm, feishuRecordDraft);

                    return (
                      <tr key={record.record_id} className={isEditing ? 'editing-row' : ''}>
                        {FEISHU_FIELDS.map((field) => {
                          const cellValue = rowDraft[field.key];
                          const isCellEditing = isEditing && feishuEditingField === field.key;
                          const displayValue = (() => {
                            const value = isEditing ? rowDraft[field.key] : fields[field.key];
                            if (field.key === '负责人') {
                              const name = isEditing ? String(value ?? '') : getAssigneeName(fields['负责人']);
                              return name || '-';
                            }
                            if (field.key === '开始时间' || field.key === '截止时间') {
                              return formatDateValue(value) || '-';
                            }
                            if (field.key === '进度') {
                              return formatProgressValue(value);
                            }
                            return formatFeishuValue(value);
                          })();

                          if (isCellEditing) {
                            const options = field.key === '所属项目'
                              ? feishuProjectOptions
                              : field.options ?? [];
                            if (field.type === 'select') {
                              return (
                                <td key={String(field.key)} className="editing">
                                  <select
                                    data-feishu-edit={`${record.record_id}-${String(field.key)}`}
                                    value={cellValue ?? ''}
                                    onChange={(e) => updateFeishuRecordDraft(field.key, e.target.value)}
                                    onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineFeishuEdit(record), cancelInlineFeishuEdit)}
                                    onBlur={() => finalizeInlineFeishuEdit(record)}
                                  >
                                    {options.map((option) => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                  </select>
                                </td>
                              );
                            }
                            return (
                              <td key={String(field.key)} className="editing">
                                <input
                                  data-feishu-edit={`${record.record_id}-${String(field.key)}`}
                                  type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                                  value={cellValue ?? ''}
                                  onChange={(e) => updateFeishuRecordDraft(field.key, e.target.value)}
                                  onKeyDown={(e) => handleInlineKeyDown(e, () => void saveInlineFeishuEdit(record), cancelInlineFeishuEdit)}
                                  onBlur={() => finalizeInlineFeishuEdit(record)}
                                />
                              </td>
                            );
                          }

                          return (
                            <td
                              key={String(field.key)}
                              onDoubleClick={() => canWrite && startInlineFeishuEdit(record, field.key)}
                            >
                              {displayValue}
                            </td>
                          );
                        })}
                        {canWrite && (
                          <td style={{ display: 'flex', gap: 6 }}>
                            {isEditing && isDirty ? (
                              <>
                                <button className="btn" type="button" disabled={!isDirty} onClick={() => void saveInlineFeishuEdit(record)}>保存</button>
                                <button className="btn" type="button" onClick={cancelInlineFeishuEdit}>取消</button>
                              </>
                            ) : (
                              <button className="btn" type="button" onClick={() => void removeFeishuRecord(record)}>删除</button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <button className="btn" type="button" onClick={goFeishuPrevPage} disabled={feishuPageStack.length === 0}>上一页</button>
                <button className="btn" type="button" onClick={goFeishuNextPage} disabled={!feishuHasMore}>下一页</button>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  记录数: {filteredFeishuRecords.length} / {feishuRecords.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {view === 'ai' && (
          <div>
            <button className="btn" onClick={generateReport}>生成周报草稿</button>
            <div className="card" style={{ marginTop: 12 }}>
              <h3>AI 周报草稿</h3>
              <pre>{aiReport || '点击上方按钮生成'}</pre>
            </div>
          </div>
        )}

        {view === 'notifications' && (
          <div className="card">
            <h3>通知中心</h3>
            <table className="table">
              <thead><tr><th>级别</th><th>标题</th><th>内容</th><th>时间</th><th>状态</th></tr></thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td>{n.level}</td>
                    <td>{n.title}</td>
                    <td>{n.message}</td>
                    <td>{new Date(n.createdAt).toLocaleString()}</td>
                    <td>
                      {n.readAt ? '已读' : <button className="btn" type="button" onClick={() => void markNotificationRead(n.id)}>标记已读</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'audit' && canWrite && (
          <div className="card">
            <h3>审计日志</h3>
            <table className="table">
              <thead><tr><th>时间</th><th>用户</th><th>角色</th><th>方法</th><th>路径</th></tr></thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.userName || '-'}</td>
                    <td>{log.userRole || '-'}</td>
                    <td>{log.method}</td>
                    <td>{log.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
