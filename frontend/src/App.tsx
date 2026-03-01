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
import { getRiskRules, listAllRiskAlerts, listRiskRuleLogs, updateRiskRule } from './api/risks';
import { createDependency, deleteDependency, listDependencies } from './api/dependencies';
import { FEISHU_DEFAULT_FORM, FEISHU_FIELD_NAMES, FEISHU_FIELDS } from './feishuConfig';
import type {
  AuthUser,
  AuditLogItem,
  ChatbotAuditItem,
  CostEntryItem,
  CostSummary,
  DashboardOverview,
  FeishuFormState,
  FeishuDependency,
  RequirementChange,
  RiskAlertsResponse,
  NotificationItem,
  ProjectItem,
  Requirement,
  UserItem,
  Worklog
} from './types';
import type { FeishuUserItem } from './views/FeishuUsersView';
import DashboardView from './views/DashboardView';
import RequirementsView from './views/RequirementsView';
import CostsView from './views/CostsView';
import ScheduleView from './views/ScheduleView';
import ResourcesView from './views/ResourcesView';
import RiskAlertsView from './views/RiskAlertsView';
import RiskCenterView from './views/RiskCenterView';
import FeishuView from './views/FeishuView';
import NotificationsView from './views/NotificationsView';
import AuditView from './views/AuditView';
import AiView from './views/AiView';
import SettingsView from './views/SettingsView';
import FeishuUsersView from './views/FeishuUsersView';
import PmAssistantView from './views/PmAssistantView';
import ProjectAccessView from './views/ProjectAccessView';
import MilestoneBoardView from './views/MilestoneBoardView';
import AstraeaLayout, { PlatformMode } from './components/AstraeaLayout';
import ThemedSelect from './components/ui/ThemedSelect';

type ViewKey = 'dashboard' | 'requirements' | 'costs' | 'schedule' | 'resources' | 'risks' | 'ai' | 'notifications' | 'audit' | 'feishu' | 'feishu-users' | 'pm-assistant' | 'global' | 'settings' | 'project-access' | 'milestone-board';
type FeishuScheduleRow = FeishuFormState & { recordId: string };
type ThemeMode = 'light' | 'dark' | 'nebula' | 'forest' | 'sunset' | 'sakura' | 'metal';
const VALID_THEMES: ThemeMode[] = ['light', 'dark', 'nebula', 'forest', 'sunset', 'sakura', 'metal'];
const WORKSPACE_VIEWS: ViewKey[] = ['dashboard', 'requirements', 'costs', 'schedule', 'resources', 'risks', 'ai', 'notifications', 'feishu', 'pm-assistant', 'global', 'milestone-board'];
const ADMIN_VIEWS: ViewKey[] = ['audit', 'settings', 'project-access', 'feishu-users'];

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
    const allowed: ViewKey[] = ['dashboard', 'requirements', 'costs', 'schedule', 'resources', 'ai', 'notifications', 'audit', 'feishu', 'feishu-users', 'pm-assistant', 'global', 'settings', 'project-access', 'milestone-board'];
    return allowed.includes(raw as ViewKey) ? (raw as ViewKey) : 'dashboard';
  });
  const [platform, setPlatform] = useState<PlatformMode>(() => {
    const raw = localStorage.getItem('pm_platform');
    return raw === 'admin' ? 'admin' : 'workspace';
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const raw = localStorage.getItem('ui:theme');
    return VALID_THEMES.includes(raw as ThemeMode) ? (raw as ThemeMode) : 'light';
  });
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [feishuUsers, setFeishuUsers] = useState<FeishuUserItem[]>([]);
  const [requirementChanges, setRequirementChanges] = useState<RequirementChange[]>([]);
  const [selectedRequirementForChanges, setSelectedRequirementForChanges] = useState<Requirement | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [costEntries, setCostEntries] = useState<CostEntryItem[]>([]);
  const [worklogs, setWorklogs] = useState<Worklog[]>([]);
  const [aiReport, setAiReport] = useState<string>('');
  const [aiReportSource, setAiReportSource] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [chatbotAuditLogs, setChatbotAuditLogs] = useState<ChatbotAuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [lastRetry, setLastRetry] = useState<{ label: string; action: () => Promise<void> } | null>(null);
  const [retrying, setRetrying] = useState(false);

  async function refreshAll(projectIdOverride?: number | null) {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      await runWithRetry('刷新数据', async () => {
        const [dashboardRes, projectList, userList, unreadNotifications, feishuUserList] = await Promise.all([
          apiGet<DashboardOverview>('/dashboard/overview'),
          apiGet<ProjectItem[]>('/projects'),
          apiGet<UserItem[]>('/users'),
          apiGet<NotificationItem[]>('/notifications?unread=true'),
          apiGet<FeishuUserItem[]>('/feishu-users')
        ]);

        setOverview(dashboardRes);
        setProjects(projectList);
        setUsers(userList);
        setFeishuUsers(feishuUserList);
        setSelectedProjectIds((prev) => prev.filter((id) => projectList.some((item) => item.id === id)));
        setNotifications(unreadNotifications);

        const activeProjectId = projectIdOverride ?? selectedProjectId ?? projectList[0]?.id ?? null;
        setSelectedProjectId(activeProjectId);

        if (!activeProjectId) {
          setRequirements([]);
          setRequirementChanges([]);
          setSelectedRequirementForChanges(null);
          setCostSummary(null);
          setCostEntries([]);
          setWorklogs([]);
          return;
        }

        const [reqRes, costRes, costListRes, worklogRes, projectNotifications] = await Promise.all([
          apiGet<Requirement[]>(`/requirements?projectId=${activeProjectId}`),
          apiGet<CostSummary>(`/cost-entries/summary?projectId=${activeProjectId}`),
          apiGet<CostEntryItem[]>(`/cost-entries?projectId=${activeProjectId}`),
          apiGet<Worklog[]>(`/worklogs?projectId=${activeProjectId}`),
          apiGet<NotificationItem[]>(`/notifications?projectId=${activeProjectId}`)
        ]);
        setRequirements(reqRes);
        setCostSummary(costRes);
        setCostEntries(costListRes);
        setWorklogs(worklogRes);
        setNotifications(projectNotifications);
      });
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
    setUsers([]);
    setSelectedProjectIds([]);
    setSelectedProjectId(null);
    setRequirements([]);
    setCostSummary(null);
    setCostEntries([]);
    setWorklogs([]);
    setAiReport('');
    setNotifications([]);
    setAuditLogs([]);
    setChatbotAuditLogs([]);
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

  useEffect(() => {
    localStorage.setItem('pm_platform', platform);
  }, [platform]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ui:theme', theme);
  }, [theme]);

  async function submitRequirement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    if (!selectedProjectId) {
      setError('请先选择项目。');
      return;
    }
    const form = new FormData(formEl);
    await runWithRetry('新增需求', async () => {
      await apiPost('/requirements', {
        projectId: selectedProjectId,
        title: String(form.get('title')),
        description: String(form.get('description')),
        priority: String(form.get('priority')),
        version: 'v1.0'
      });
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
    const alias = String(form.get('alias') || '').trim().toUpperCase();
    const budget = Number(form.get('budget'));

    if (!Number.isFinite(budget) || budget <= 0) {
      setError('预算必须是大于 0 的数字。');
      return;
    }
    if (!/^[A-Z]+$/.test(alias)) {
      setError('项目别名仅支持大写英文字母（A-Z）。');
      return;
    }

    try {
      let createdId = 0;
      await runWithRetry('新增项目', async () => {
        const created = await apiPost<{ id: number }>('/projects', {
          name,
          alias,
          budget,
          startDate: String(form.get('startDate') || ''),
          endDate: String(form.get('endDate') || ''),
          feishuChatIds: String(form.get('feishuChatIds') || '')
        });
        createdId = created.id;
      });
      formEl?.reset();
      setMessage(`项目「${name}」已创建。`);
      await refreshAll(createdId);
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
      await runWithRetry('删除项目', async () => {
        await apiDelete(`/projects/${project.id}`);
      });
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
      await runWithRetry('批量删除项目', async () => {
        for (const id of selectedProjectIds) {
          await apiDelete(`/projects/${id}`);
        }
      });
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

  function toggleRequirementSelection(id: number, checked: boolean) {
    setSelectedRequirementIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  }

  function toggleCostEntrySelection(id: number, checked: boolean) {
    setSelectedCostEntryIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  }

  function toggleFeishuSelection(id: string, checked: boolean) {
    setSelectedFeishuIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  }

  function toggleFeishuColumn(key: keyof FeishuFormState, checked: boolean) {
    setFeishuVisibleColumns((prev) => {
      if (checked) {
        if (prev.includes(key)) return prev;
        return [...prev, key];
      }
      return prev.filter((item) => item !== key);
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

  async function runWithRetry(label: string, action: () => Promise<void>) {
    try {
      await action();
      setLastRetry(null);
    } catch (err) {
      setLastRetry({ label, action });
      throw err;
    }
  }

  async function handleRetry() {
    if (!lastRetry || retrying) return;
    setRetrying(true);
    try {
      await lastRetry.action();
      setLastRetry(null);
    } catch {
      // keep lastRetry for subsequent attempts
    } finally {
      setRetrying(false);
    }
  }

  async function saveInlineProjectEdit(original: ProjectItem) {
    const draft = projectEdit.draft;
    if (!draft || !projectEdit.hasDirty(original)) return;
    setMessage('');
    setError('');
    const budget = Number(draft.budget);
    const alias = String(draft.alias || '').trim().toUpperCase();
    if (!Number.isFinite(budget) || budget <= 0) {
      setError('预算必须是大于 0 的数字。');
      return;
    }
    if (!/^[A-Z]+$/.test(alias)) {
      setError('项目别名仅支持大写英文字母（A-Z）。');
      return;
    }
    try {
      await runWithRetry('更新项目', async () => {
        await apiPatch(`/projects/${original.id}`, {
          name: String(draft.name || ''),
          alias,
          budget,
          startDate: draft.startDate || null,
          endDate: draft.endDate || null,
          feishuChatIds: draft.feishuChatIds || null
        });
      });
      setMessage(`项目「${draft.name}」已更新。`);
      projectEdit.cancel();
      await refreshAll(original.id);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新项目失败。（${detail}）`);
    }
  }

  async function saveInlineRequirementEdit(original: Requirement) {
    const draft = requirementEdit.draft;
    if (!draft || !requirementEdit.hasDirty(original)) return;
    const priority = String(draft.priority);
    const status = String(draft.status);
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
      await runWithRetry('更新需求', async () => {
        await apiPatch(`/requirements/${original.id}`, {
          title: draft.title,
          description: draft.description,
          priority,
          status
        });
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
    const draft = costEdit.draft;
    if (!draft || !costEdit.hasDirty(original)) return;
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('金额必须是非负数字。');
      return;
    }
    const type = String(draft.type);
    if (!['labor', 'outsource', 'cloud'].includes(type)) {
      setError('成本类型只能是 labor/outsource/cloud。');
      return;
    }
    setMessage('');
    setError('');
    try {
      await runWithRetry('更新成本条目', async () => {
        await apiPatch(`/cost-entries/${original.id}`, {
          type,
          amount,
          occurredOn: draft.occurredOn,
          note: draft.note
        });
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
    const draft = worklogEdit.draft;
    if (!draft || !worklogEdit.hasDirty(original)) return;
    const totalDays = draft.totalDays !== undefined && draft.totalDays !== null && String(draft.totalDays) !== ''
      ? Number(draft.totalDays)
      : null;
    const hours = totalDays !== null && Number.isFinite(totalDays)
      ? totalDays * 8
      : Number(draft.hours);
    const hourlyRate = Number(draft.hourlyRate);
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
      await runWithRetry('更新工时记录', async () => {
        await apiPatch(`/worklogs/${original.id}`, {
          taskTitle: draft.taskTitle,
          assigneeName: draft.assigneeName,
          weekStart: draft.weekStart,
          weekEnd: draft.weekEnd,
          totalDays: totalDays ?? undefined,
          hours,
          hourlyRate,
          workedOn: draft.weekStart || draft.workedOn
        });
      });
      setMessage(`工时 #${original.id} 已更新。`);
      worklogEdit.cancel();
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新工时失败。（${detail}）`);
    }
  }

  async function saveInlineScheduleEdit(original: FeishuScheduleRow) {
    const draft = scheduleEdit.draft;
    if (!draft || !scheduleEdit.hasDirty(original)) return;
    setMessage('');
    setError('');
    try {
      const { recordId, ...form } = draft;
      const payload = buildFeishuFieldsPayload(form);
      await runWithRetry('更新进度同步记录', async () => {
        await updateFeishuRecord(original.recordId, payload);
      });
      setMessage('进度同步记录已更新。');
      scheduleEdit.cancel();
      await loadScheduleRecords();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新进度同步记录失败。（${detail}）`);
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
    await runWithRetry('新增成本', async () => {
      await apiPost('/cost-entries', {
        projectId: selectedProjectId,
        type: String(form.get('type')),
        amount: Number(form.get('amount')),
        occurredOn: String(form.get('occurredOn')),
        note: String(form.get('note'))
      });
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
      await runWithRetry('删除成本条目', async () => {
        await apiDelete(`/cost-entries/${entry.id}`);
      });
      setMessage(`成本条目 #${entry.id} 已删除。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除成本失败。（${detail}）`);
    }
  }

  async function deleteSelectedCostEntries() {
    if (!canWrite || selectedCostEntryIds.length === 0) return;
    if (!window.confirm(`确定批量删除 ${selectedCostEntryIds.length} 条成本条目？`)) return;
    setMessage('');
    setError('');
    try {
      await runWithRetry('批量删除成本条目', async () => {
        for (const id of selectedCostEntryIds) {
          await apiDelete(`/cost-entries/${id}`);
        }
      });
      setSelectedCostEntryIds([]);
      setMessage(`已批量删除 ${selectedCostEntryIds.length} 条成本条目。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`批量删除成本条目失败。（${detail}）`);
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
    const totalDays = Number(form.get('totalDays'));
    const dailyRate = Number(form.get('dailyRate'));
    const hours = Number.isFinite(totalDays) ? totalDays * 8 : Number(form.get('hours'));
    const hourlyRate = Number.isFinite(dailyRate) ? dailyRate / 8 : Number(form.get('hourlyRate'));
    await runWithRetry('新增工时', async () => {
      await apiPost('/worklogs', {
        projectId: selectedProjectId,
        userId: user?.id,
        taskTitle: String(form.get('taskTitle') || ''),
        assigneeName: String(form.get('assigneeName') || ''),
        weekStart: String(form.get('weekStart') || ''),
        weekEnd: String(form.get('weekEnd') || ''),
        totalDays: Number.isFinite(totalDays) ? totalDays : undefined,
        hours,
        hourlyRate,
        workedOn: String(form.get('weekStart') || '')
      });
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
      await runWithRetry('删除工时记录', async () => {
        await apiDelete(`/worklogs/${worklog.id}`);
      });
      setMessage(`工时 #${worklog.id} 已删除。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除工时失败。（${detail}）`);
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
    const payloadForm: FeishuFormState = {
      任务ID: String(form.get('taskId') || '').trim(),
      任务名称: String(form.get('title') || '').trim(),
      状态: String(form.get('status') || '待办').trim(),
      优先级: '中',
      负责人: String(form.get('assignee') || '').trim(),
      开始时间: String(form.get('plannedStart') || '').trim(),
      截止时间: String(form.get('plannedEnd') || '').trim(),
      进度: String(form.get('progress') || '').trim(),
      所属项目: selectedProjectName === '未选择' ? '' : selectedProjectName,
      是否阻塞: '否',
      阻塞原因: '',
      风险等级: '中',
      里程碑: '否'
    };
    await runWithRetry('新增任务', async () => {
      await createFeishuRecord(buildFeishuFieldsPayload(payloadForm));
    });
    formEl?.reset();
    await loadScheduleRecords();
  }

  async function submitMilestone(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    if (!selectedProjectId) {
      setError('请先选择项目。');
      return;
    }
    const form = new FormData(formEl);
    const payloadForm: FeishuFormState = {
      任务ID: String(form.get('milestoneId') || '').trim(),
      任务名称: String(form.get('name') || '').trim(),
      状态: String(form.get('status') || '待办').trim(),
      优先级: '中',
      负责人: String(form.get('assignee') || '').trim(),
      开始时间: String(form.get('plannedDate') || '').trim(),
      截止时间: String(form.get('actualDate') || '').trim(),
      进度: String(form.get('progress') || '').trim(),
      所属项目: selectedProjectName === '未选择' ? '' : selectedProjectName,
      是否阻塞: '否',
      阻塞原因: '',
      风险等级: '中',
      里程碑: '是'
    };
    await runWithRetry('新增里程碑', async () => {
      await createFeishuRecord(buildFeishuFieldsPayload(payloadForm));
    });
    formEl?.reset();
    await loadScheduleRecords();
  }

  async function deleteScheduleRow(row: FeishuScheduleRow) {
    if (!canWrite) return;
    const label = row.任务名称 || row.任务ID || '记录';
    if (!window.confirm(`确定删除「${label}」？`)) return;
    setMessage('');
    setError('');
    try {
      await runWithRetry('删除进度同步记录', async () => {
        await deleteFeishuRecord(row.recordId);
      });
      setMessage('记录已删除。');
      await loadScheduleRecords();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除失败。（${detail}）`);
    }
  }

  async function deleteRequirement(req: Requirement) {
    if (!canWrite) return;
    if (!window.confirm(`确定删除需求「${req.title}」？`)) return;
    setMessage('');
    setError('');
    try {
      await runWithRetry('删除需求', async () => {
        await apiDelete(`/requirements/${req.id}`);
      });
      setMessage(`需求 #${req.id} 已删除。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除需求失败。（${detail}）`);
    }
  }

  async function deleteSelectedRequirements() {
    if (!canWrite || selectedRequirementIds.length === 0) return;
    if (!window.confirm(`确定批量删除 ${selectedRequirementIds.length} 条需求？`)) return;
    setMessage('');
    setError('');
    try {
      await runWithRetry('批量删除需求', async () => {
        for (const id of selectedRequirementIds) {
          await apiDelete(`/requirements/${id}`);
        }
      });
      setSelectedRequirementIds([]);
      setMessage(`已批量删除 ${selectedRequirementIds.length} 条需求。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`批量删除需求失败。（${detail}）`);
    }
  }

  async function reviewRequirementAction(id: number, decision: 'approved' | 'rejected') {
    if (!canWrite) return;
    await runWithRetry('需求审核', async () => {
      await apiPost(`/requirements/${id}/review`, {
        reviewer: user?.name ?? 'PM Demo',
        decision
      });
    });
    await refreshAll(selectedProjectId);
  }

  async function markRequirementChanged(req: Requirement, input: { description: string; reason: string; version: string }) {
    if (!canWrite) return;
    await runWithRetry('记录需求变更', async () => {
      await apiPost(`/requirements/${req.id}/change`, {
        description: input.description,
        version: input.version,
        reason: input.reason,
        changedBy: user?.name ?? 'PM Demo'
      });
    });
    await refreshAll(selectedProjectId);
    await loadRequirementChanges(req);
  }

  async function loadRequirementChanges(req: Requirement) {
    if (!token) return;
    try {
      const changes = await apiGet<RequirementChange[]>(`/requirements/${req.id}/changes`);
      setRequirementChanges(changes);
      setSelectedRequirementForChanges(req);
    } catch {
      setRequirementChanges([]);
      setSelectedRequirementForChanges(req);
    }
  }

  async function toggleRequirementChanges(req: Requirement) {
    if (selectedRequirementForChanges?.id === req.id) {
      setSelectedRequirementForChanges(null);
      setRequirementChanges([]);
      return;
    }
    await loadRequirementChanges(req);
  }

  function closeRequirementChanges() {
    setSelectedRequirementForChanges(null);
    setRequirementChanges([]);
  }

  async function generateReport() {
    if (!selectedProjectId) {
      setError('请先选择项目。');
      return;
    }
    // 动态计算本周一和本周日的日期
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=周日, 1=周一, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    try {
      await runWithRetry('生成周报', async () => {
        const res = await apiPost<{ report: string; source?: string }>('/ai/reports/weekly', {
          projectIds: [selectedProjectId],
          weekStart: fmt(monday),
          weekEnd: fmt(sunday),
          includeRisks: true,
          includeBudget: true
        });
        setAiReport(res.report);
        setAiReportSource(res.source ?? 'template');
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`生成周报失败。（${detail}）`);
    }
  }

  async function loadAuditLogs() {
    if (!canWrite) return;
    const qs = selectedProjectId ? `?projectId=${selectedProjectId}` : '';
    try {
      await runWithRetry('加载审计日志', async () => {
        const [rows, chatRows] = await Promise.all([
          apiGet<AuditLogItem[]>(`/audit-logs${qs}`),
          apiGet<ChatbotAuditItem[]>('/audit-logs/chatbot')
        ]);
        setAuditLogs(rows);
        setChatbotAuditLogs(chatRows);
      });
    } catch {
      // error already tracked via retry
    }
  }

  async function markNotificationRead(id: number) {
    await runWithRetry('标记通知已读', async () => {
      await apiPost(`/notifications/${id}/read`, {});
    });
    await refreshAll(selectedProjectId);
  }

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return '未选择';
    return projects.find((item) => item.id === selectedProjectId)?.name ?? `#${selectedProjectId}`;
  }, [projects, selectedProjectId]);
  const selectedProjectAlias = useMemo(() => {
    if (!selectedProjectId) return '';
    return projects.find((item) => item.id === selectedProjectId)?.alias?.trim() ?? '';
  }, [projects, selectedProjectId]);
  const userRole = String(user?.role || '');
  const canWrite = ['super_admin', 'project_director', 'project_manager', 'lead', 'pm'].includes(userRole);
  const canManageAdmin = ['super_admin', 'project_director', 'lead'].includes(userRole);
  const canAccessAdminPlatform = canManageAdmin;

  useEffect(() => {
    if (!canAccessAdminPlatform && platform === 'admin') {
      setPlatform('workspace');
    }
  }, [canAccessAdminPlatform, platform]);

  useEffect(() => {
    if (platform === 'workspace' && ADMIN_VIEWS.includes(view)) {
      setView('dashboard');
      return;
    }
    if (platform === 'admin' && WORKSPACE_VIEWS.includes(view)) {
      setView('audit');
    }
  }, [platform, view]);

  useEffect(() => {
    if (!canManageAdmin && view === 'project-access') {
      setView('dashboard');
    }
  }, [canManageAdmin, view]);

  useEffect(() => {
    if (view === 'audit' && canWrite) {
      void loadAuditLogs();
    }
  }, [view, selectedProjectId, canWrite]);

  const [feishuRecords, setFeishuRecords] = useState<FeishuRecord[]>([]);
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [feishuError, setFeishuError] = useState('');
  const [feishuMessage, setFeishuMessage] = useState('');
  const [feishuForm, setFeishuForm] = useState<FeishuFormState>(FEISHU_DEFAULT_FORM);
  const [feishuEditingId, setFeishuEditingId] = useState<string | null>(null);
  const [feishuEditingField, setFeishuEditingField] = useState<keyof FeishuFormState | null>(null);
  const [feishuRecordDraft, setFeishuRecordDraft] = useState<FeishuFormState | null>(null);
  const [scheduleRecords, setScheduleRecords] = useState<FeishuRecord[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleDependencies, setScheduleDependencies] = useState<FeishuDependency[]>([]);
  const [scheduleDependenciesError, setScheduleDependenciesError] = useState('');
  const [riskAlerts, setRiskAlerts] = useState<RiskAlertsResponse | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState('');
  const [riskMessage, setRiskMessage] = useState('');
  const [riskReady, setRiskReady] = useState(false);
  const [riskRules, setRiskRules] = useState<Array<{
    id: number;
    key: string;
    type: string;
    name: string;
    enabled: boolean;
    thresholdDays: number;
    progressThreshold: number;
    includeMilestones: boolean;
    autoNotify: boolean;
    blockedValue?: string | null;
  }>>([]);
  const [riskRuleLogs, setRiskRuleLogs] = useState<Array<{ id: number; ruleId: number; action: string; note?: string | null; createdAt: string }>>([]);
  const [riskFilters, setRiskFilters] = useState(() => ({
    thresholdDays: 7,
    progressThreshold: 80,
    filterProject: '',
    filterStatus: '',
    filterAssignee: '',
    filterRisk: '',
    includeMilestones: false,
    autoNotify: true,
    enabled: true
  }));
  const updateRiskFilters = (next: Partial<typeof riskFilters>) => {
    setRiskFilters((prev) => ({ ...prev, ...next }));
  };

  const updateRiskRuleLocal = (key: string, patch: Partial<{ enabled: boolean; autoNotify: boolean; blockedValue?: string | null }>) => {
    setRiskRules((prev) => prev.map((rule) => (rule.key === key ? { ...rule, ...patch } : rule)));
  };
  const [feishuPageSize, setFeishuPageSize] = useState(() => {
    const raw = localStorage.getItem('feishu_page_size');
    const size = raw ? Number(raw) : 20;
    return Number.isFinite(size) && size > 0 ? size : 20;
  });
  const [feishuPageToken, setFeishuPageToken] = useState<string | undefined>(undefined);
  const [feishuPageStack, setFeishuPageStack] = useState<string[]>([]);
  const [feishuNextToken, setFeishuNextToken] = useState<string | undefined>(undefined);
  const [feishuHasMore, setFeishuHasMore] = useState(false);
  const [feishuSearch, setFeishuSearch] = useState(() => localStorage.getItem('feishu_search') || '');
  const [feishuSearchFields, setFeishuSearchFields] = useState('');
  const [feishuFilter, setFeishuFilter] = useState('');
  const [feishuSort, setFeishuSort] = useState('');
  const [feishuFilterProject, setFeishuFilterProject] = useState(() => localStorage.getItem('feishu_filter_project') || '');
  const [feishuFilterStatus, setFeishuFilterStatus] = useState(() => localStorage.getItem('feishu_filter_status') || '');
  const [feishuFilterAssignee, setFeishuFilterAssignee] = useState(() => localStorage.getItem('feishu_filter_assignee') || '');
  const [feishuFilterRisk, setFeishuFilterRisk] = useState(() => localStorage.getItem('feishu_filter_risk') || '');
  const [feishuVisibleColumns, setFeishuVisibleColumns] = useState<Array<keyof FeishuFormState>>(() => {
    const raw = localStorage.getItem('feishu_visible_columns');
    if (!raw) return FEISHU_FIELDS.map((field) => field.key);
    try {
      const parsed = JSON.parse(raw) as Array<keyof FeishuFormState>;
      return parsed.length > 0 ? parsed : FEISHU_FIELDS.map((field) => field.key);
    } catch {
      return FEISHU_FIELDS.map((field) => field.key);
    }
  });
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<number[]>([]);
  const [selectedCostEntryIds, setSelectedCostEntryIds] = useState<number[]>([]);
  const [selectedFeishuIds, setSelectedFeishuIds] = useState<string[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const raw = localStorage.getItem('pm_notification_settings');
    if (!raw) return { riskThreshold: 2, budgetVarianceThreshold: 10, enableSystemAlerts: true };
    try {
      return JSON.parse(raw) as { riskThreshold: number; budgetVarianceThreshold: number; enableSystemAlerts: boolean };
    } catch {
      return { riskThreshold: 2, budgetVarianceThreshold: 10, enableSystemAlerts: true };
    }
  });
  const scheduleRows = useMemo(
    () => scheduleRecords.map((record) => mapRecordToScheduleRow(record)),
    [scheduleRecords]
  );
  const scheduleTasks = useMemo(
    () => scheduleRows.filter((row) => String(row.里程碑 ?? '否') !== '是'),
    [scheduleRows]
  );
  const scheduleMilestones = useMemo(
    () => scheduleRows.filter((row) => String(row.里程碑 ?? '否') === '是'),
    [scheduleRows]
  );
  const scheduleRiskText = useMemo(() => {
    if (scheduleRows.length === 0) return 'N/A';
    const blockedCount = scheduleRows.filter((row) => String(row.是否阻塞 ?? '否') === '是').length;
    const rank: Record<string, number> = { 高: 3, 中: 2, 低: 1 };
    let maxRank = 0;
    for (const row of scheduleRows) {
      const level = String(row.风险等级 ?? '');
      const score = rank[level] ?? 0;
      if (score > maxRank) maxRank = score;
    }
    const levelText = maxRank === 3 ? '高' : maxRank === 2 ? '中' : maxRank === 1 ? '低' : 'N/A';
    return `${levelText} (blocked: ${blockedCount})`;
  }, [scheduleRows]);
  const globalSearchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return null;
    const projectMatches = projects.filter((p) =>
      matchesSearch(p.name, query) || matchesSearch(p.alias, query) || matchesSearch(p.id, query)
    );
    const requirementMatches = requirements.filter((r) =>
      matchesSearch(r.title, query) || matchesSearch(r.description, query) || matchesSearch(r.status, query)
    );
    const costMatches = costEntries.filter((c) =>
      matchesSearch(c.type, query) || matchesSearch(c.note, query) || matchesSearch(c.amount, query)
    );
    const worklogMatches = worklogs.filter((w) =>
      matchesSearch(w.taskTitle, query) || matchesSearch(w.workedOn, query)
    );
    const taskMatches = scheduleTasks.filter((t) =>
      matchesSearch(t.任务名称, query) || matchesSearch(t.负责人, query) || matchesSearch(t.状态, query)
    );
    const milestoneMatches = scheduleMilestones.filter((m) =>
      matchesSearch(m.任务名称, query) || matchesSearch(m.开始时间, query) || matchesSearch(m.截止时间, query)
    );
    const feishuMatches = feishuRecords.filter((record) => {
      const fields = record.fields || {};
      return Object.values(fields).some((value) => matchesSearch(value, query));
    });

    return {
      projects: projectMatches.slice(0, 5),
      requirements: requirementMatches.slice(0, 5),
      costs: costMatches.slice(0, 5),
      worklogs: worklogMatches.slice(0, 5),
      tasks: taskMatches.slice(0, 5),
      milestones: milestoneMatches.slice(0, 5),
      feishu: feishuMatches.slice(0, 5),
      counts: {
        projects: projectMatches.length,
        requirements: requirementMatches.length,
        costs: costMatches.length,
        worklogs: worklogMatches.length,
        tasks: taskMatches.length,
        milestones: milestoneMatches.length,
        feishu: feishuMatches.length
      }
    };
  }, [globalSearch, projects, requirements, costEntries, worklogs, scheduleTasks, scheduleMilestones, feishuRecords]);
  const projectEdit = useInlineEdit<ProjectItem, number>({
    getId: (row) => row.id,
    hasChanges: (original, draft) => (
      original.name !== draft.name
      || String(original.alias ?? '') !== String(draft.alias ?? '')
      || String(original.budget) !== String(draft.budget)
      || String(original.startDate ?? '') !== String(draft.startDate ?? '')
      || String(original.endDate ?? '') !== String(draft.endDate ?? '')
      || String(original.feishuChatIds ?? '') !== String(draft.feishuChatIds ?? '')
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
      || String(original.assigneeName ?? '') !== String(draft.assigneeName ?? '')
      || String(original.weekStart ?? '') !== String(draft.weekStart ?? '')
      || String(original.weekEnd ?? '') !== String(draft.weekEnd ?? '')
      || String(original.totalDays ?? '') !== String(draft.totalDays ?? '')
      || String(original.hours) !== String(draft.hours)
      || String(original.hourlyRate) !== String(draft.hourlyRate)
      || original.workedOn !== draft.workedOn
    ),
    selector: (id, field) => `[data-worklog-edit="${id}-${String(field)}"]`
  });
  const scheduleEdit = useInlineEdit<FeishuScheduleRow, string>({
    getId: (row) => row.recordId,
    hasChanges: (original, draft) => (
      original.任务ID !== draft.任务ID
      || original.任务名称 !== draft.任务名称
      || original.负责人 !== draft.负责人
      || original.状态 !== draft.状态
      || original.开始时间 !== draft.开始时间
      || original.截止时间 !== draft.截止时间
      || original.进度 !== draft.进度
      || original.里程碑 !== draft.里程碑
    ),
    selector: (id, field) => `[data-schedule-edit="${id}-${String(field)}"]`
  });

  useEffect(() => {
    localStorage.setItem('pm_notification_settings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  useEffect(() => {
    setSelectedRequirementIds((prev) => prev.filter((id) => requirements.some((item) => item.id === id)));
  }, [requirements]);

  useEffect(() => {
    setSelectedCostEntryIds((prev) => prev.filter((id) => costEntries.some((item) => item.id === id)));
  }, [costEntries]);

  useEffect(() => {
    setSelectedFeishuIds((prev) => prev.filter((id) => feishuRecords.some((item) => item.record_id === id)));
  }, [feishuRecords]);

  useEffect(() => {
    localStorage.setItem('feishu_search', feishuSearch);
  }, [feishuSearch]);

  useEffect(() => {
    localStorage.setItem('feishu_filter_project', feishuFilterProject);
  }, [feishuFilterProject]);

  useEffect(() => {
    localStorage.setItem('feishu_filter_status', feishuFilterStatus);
  }, [feishuFilterStatus]);

  useEffect(() => {
    localStorage.setItem('feishu_filter_assignee', feishuFilterAssignee);
  }, [feishuFilterAssignee]);

  useEffect(() => {
    localStorage.setItem('feishu_filter_risk', feishuFilterRisk);
  }, [feishuFilterRisk]);

  useEffect(() => {
    localStorage.setItem('feishu_page_size', String(feishuPageSize));
  }, [feishuPageSize]);

  useEffect(() => {
    localStorage.setItem('feishu_visible_columns', JSON.stringify(feishuVisibleColumns));
  }, [feishuVisibleColumns]);

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
      风险等级: String(fields['风险等级'] ?? '中'),
      里程碑: String(fields['里程碑'] ?? '否')
    };
  }

  function mapRecordToScheduleRow(record: FeishuRecord): FeishuScheduleRow {
    return {
      ...mapRecordToForm(record),
      recordId: record.record_id
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
      风险等级: form.风险等级.trim(),
      里程碑: form.里程碑.trim()
    };

    const start = form.开始时间 ? new Date(form.开始时间).getTime() : null;
    const end = form.截止时间 ? new Date(form.截止时间).getTime() : null;
    payload['开始时间'] = Number.isFinite(start) ? start : null;
    payload['截止时间'] = Number.isFinite(end) ? end : null;

    const progress = Number(form.进度);
    payload['进度'] = Number.isFinite(progress) ? progress : null;
    return payload;
  }

  function buildFeishuPatchPayload(original: FeishuFormState, draft: FeishuFormState) {
    const prev = buildFeishuFieldsPayload(original);
    const next = buildFeishuFieldsPayload(draft);
    const patch: Record<string, unknown> = {};
    Object.keys(next).forEach((key) => {
      if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
        patch[key] = next[key];
      }
    });
    return patch;
  }

  async function loadFeishuRecords(options?: { resetPage?: boolean }) {
    if (!token) return;
    setFeishuLoading(true);
    setFeishuError('');
    try {
      await runWithRetry('刷新飞书记录', async () => {
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
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setFeishuError(`获取记录失败。（${detail}）`);
    } finally {
      setFeishuLoading(false);
    }
  }

  async function loadScheduleRecords() {
    if (!token) return;
    setScheduleLoading(true);
    setScheduleError('');
    try {
      await runWithRetry('刷新进度同步记录', async () => {
        const projectFilter = selectedProjectName && selectedProjectName !== '未选择' ? selectedProjectName : undefined;
        const res = await listFeishuRecords({
          pageSize: 200,
          fieldNames: FEISHU_FIELD_NAMES,
          filterProject: projectFilter
        });
        setScheduleRecords(res.items || []);
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setScheduleError(`获取进度同步记录失败。（${detail}）`);
    } finally {
      setScheduleLoading(false);
    }
  }

  async function loadScheduleDependencies() {
    if (!token) return;
    setScheduleDependenciesError('');
    try {
      const projectFilter = selectedProjectName && selectedProjectName !== '未选择' ? selectedProjectName : undefined;
      const deps = await listDependencies(projectFilter);
      setScheduleDependencies(deps);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setScheduleDependenciesError(`获取任务依赖失败。（${detail}）`);
    }
  }

  async function loadRiskAlerts() {
    if (!token) return;
    setRiskLoading(true);
    setRiskError('');
    setRiskMessage('');
    try {
      await runWithRetry('加载风险预警', async () => {
        const projectFilter = selectedProjectName && selectedProjectName !== '未选择' ? selectedProjectName : undefined;
        const res = await listAllRiskAlerts({
          filterProject: riskFilters.filterProject || projectFilter,
          filterStatus: riskFilters.filterStatus,
          filterAssignee: riskFilters.filterAssignee,
          filterRisk: riskFilters.filterRisk
        });
        setRiskAlerts(res);
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setRiskError(`获取风险清单失败。（${detail}）`);
    } finally {
      setRiskLoading(false);
    }
  }

  async function loadRiskRule() {
    if (!token) return;
    setRiskLoading(true);
    setRiskError('');
    setRiskMessage('');
    try {
      await runWithRetry('加载风险规则', async () => {
        const rules = await getRiskRules();
        setRiskRules(rules);
        const deadlineRule = rules.find((item) => item.type === 'deadline_progress');
        if (deadlineRule) {
          setRiskFilters((prev) => ({
            ...prev,
            thresholdDays: deadlineRule.thresholdDays,
            progressThreshold: deadlineRule.progressThreshold,
            includeMilestones: deadlineRule.includeMilestones,
            autoNotify: deadlineRule.autoNotify,
            enabled: deadlineRule.enabled
          }));
        }
        const logs = await listRiskRuleLogs();
        setRiskRuleLogs(logs);
        setRiskReady(true);
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setRiskError(`获取风险规则失败。（${detail}）`);
    } finally {
      setRiskLoading(false);
    }
  }

  async function saveRiskRule() {
    if (!token || !canWrite) return;
    setRiskLoading(true);
    setRiskError('');
    setRiskMessage('');
    try {
      await runWithRetry('保存风险规则', async () => {
        const updates = [
          updateRiskRule({
            key: 'deadline_progress',
            thresholdDays: riskFilters.thresholdDays,
            progressThreshold: riskFilters.progressThreshold,
            includeMilestones: riskFilters.includeMilestones,
            autoNotify: riskFilters.autoNotify,
            enabled: riskFilters.enabled
          }),
          ...riskRules
            .filter((rule) => rule.key !== 'deadline_progress')
            .map((rule) =>
              updateRiskRule({
                key: rule.key,
                enabled: rule.enabled,
                autoNotify: rule.autoNotify,
                blockedValue: rule.blockedValue ?? undefined
              })
            )
        ];
        await Promise.all(updates);
        const rules = await getRiskRules();
        setRiskRules(rules);
        const logs = await listRiskRuleLogs();
        setRiskRuleLogs(logs);
      });
      setRiskMessage('风险规则已保存。');
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setRiskError(`保存风险规则失败。（${detail}）`);
    } finally {
      setRiskLoading(false);
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
      const payload = buildFeishuPatchPayload(originalForm, feishuRecordDraft);
      if (Object.keys(payload).length === 0) {
        cancelInlineFeishuEdit();
        return;
      }
      await runWithRetry('更新飞书记录', async () => {
        await updateFeishuRecord(original.record_id, payload);
      });
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

  async function addScheduleDependency(input: {
    taskRecordId: string;
    dependsOnRecordId: string;
    type: 'FS' | 'SS' | 'FF';
  }) {
    if (!token || !canWrite) return;
    const projectName = selectedProjectName && selectedProjectName !== '未选择' ? selectedProjectName : '';
    if (!projectName) return;
    const task = scheduleTasks.find((item) => item.recordId === input.taskRecordId);
    const dependsOn = scheduleTasks.find((item) => item.recordId === input.dependsOnRecordId);
    await runWithRetry('新增任务依赖', async () => {
      await createDependency({
        projectName,
        taskRecordId: input.taskRecordId,
        taskId: task?.任务ID,
        dependsOnRecordId: input.dependsOnRecordId,
        dependsOnTaskId: dependsOn?.任务ID,
        type: input.type
      });
      await loadScheduleDependencies();
    });
  }

  async function removeScheduleDependency(id: number) {
    if (!token || !canWrite) return;
    await runWithRetry('删除任务依赖', async () => {
      await deleteDependency(id);
      await loadScheduleDependencies();
    });
  }

  async function submitFeishuRecord(e: import('react').FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    setFeishuError('');
    setFeishuMessage('');
    try {
      const payload = buildFeishuFieldsPayload(feishuForm);
      if (feishuEditingId) {
        await runWithRetry('提交飞书记录', async () => {
          await updateFeishuRecord(feishuEditingId, payload);
        });
        setFeishuMessage('飞书记录已更新。');
      } else {
        await runWithRetry('提交飞书记录', async () => {
          await createFeishuRecord(payload);
        });
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
      await runWithRetry('删除飞书记录', async () => {
        await deleteFeishuRecord(record.record_id);
      });
      setFeishuMessage('飞书记录已删除。');
      await loadFeishuRecords();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setFeishuError(`删除失败。（${detail}）`);
    }
  }

  async function removeSelectedFeishuRecords() {
    if (!canWrite || selectedFeishuIds.length === 0) return;
    if (!window.confirm(`确定批量删除 ${selectedFeishuIds.length} 条飞书记录？`)) return;
    setFeishuError('');
    setFeishuMessage('');
    try {
      await runWithRetry('批量删除飞书记录', async () => {
        for (const id of selectedFeishuIds) {
          await deleteFeishuRecord(id);
        }
      });
      setSelectedFeishuIds([]);
      setFeishuMessage(`已批量删除 ${selectedFeishuIds.length} 条飞书记录。`);
      await loadFeishuRecords();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setFeishuError(`批量删除失败。（${detail}）`);
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

  function exportFeishuCsv() {
    const header = FEISHU_FIELDS.map((field) => field.key);
    const rows = [
      header,
      ...feishuRecords.map((record) => {
        const form = mapRecordToForm(record);
        return FEISHU_FIELDS.map((field) => String(form[field.key] ?? ''));
      })
    ];
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`feishu-records-${date}.csv`, rows);
  }

  async function importFeishuCsv(file: File) {
    if (!canWrite) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setFeishuError('CSV 没有可导入的数据。');
      return;
    }
    const headers = rows[0].map((h) => h.trim());
    const fieldMap = headers.map((header) => {
      const field = FEISHU_FIELDS.find((item) => item.key === header || item.label === header);
      return field?.key ?? null;
    });
    if (!fieldMap.some((item) => item)) {
      setFeishuError('CSV 表头未匹配到任何字段。');
      return;
    }

    setFeishuError('');
    setFeishuMessage('');
    try {
      await runWithRetry('导入飞书CSV', async () => {
        for (let i = 1; i < rows.length; i += 1) {
          const row = rows[i];
          const form = { ...FEISHU_DEFAULT_FORM } as FeishuFormState;
          fieldMap.forEach((fieldKey, index) => {
            if (!fieldKey) return;
            form[fieldKey] = String(row[index] ?? '').trim();
          });
          const payload = buildFeishuFieldsPayload(form);
          await createFeishuRecord(payload);
        }
      });
      setFeishuMessage(`CSV 导入完成（${rows.length - 1} 条）。`);
      await loadFeishuRecords({ resetPage: true });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setFeishuError(`CSV 导入失败。（${detail}）`);
    }
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

  function matchesSearch(value: unknown, query: string) {
    if (!value) return false;
    if (typeof value === 'string') return value.toLowerCase().includes(query);
    return JSON.stringify(value).toLowerCase().includes(query);
  }

  function escapeCsvValue(value: string) {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  function downloadCsv(filename: string, rows: string[][]) {
    const content = rows.map((row) => row.map((cell) => escapeCsvValue(String(cell ?? ''))).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function parseCsv(text: string) {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
        continue;
      }
      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (current !== '' || row.length > 0) {
          row.push(current);
          rows.push(row);
          row = [];
          current = '';
        }
        continue;
      }
      current += char;
    }
    if (current !== '' || row.length > 0) {
      row.push(current);
      rows.push(row);
    }
    return rows;
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

  useEffect(() => {
    if (token && view === 'schedule') {
      void loadScheduleRecords();
      void loadScheduleDependencies();
    }
  }, [token, view, selectedProjectName]);

  useEffect(() => {
    if (token && view === 'resources') {
      void loadScheduleRecords();
    }
  }, [token, view, selectedProjectName]);

  useEffect(() => {
    if (token && view === 'risks') {
      void loadRiskRule();
    }
  }, [token, view]);

  useEffect(() => {
    if (token && view === 'risks' && riskReady) {
      void loadRiskAlerts();
    }
  }, [token, view, selectedProjectName, riskFilters, riskReady]);


  const filteredFeishuRecords = feishuRecords;
  const feishuProjectOptions = Array.from(
    new Set(
      [
        ...projects.map((project) => project.name),
        ...feishuRecords.map((record) => String((record.fields || {})['所属项目'] ?? ''))
      ].filter((value) => value)
    )
  );
  const riskProjectOptions = Array.from(
    new Set(
      [
        ...projects.map((project) => project.name),
        ...scheduleRecords.map((record) => String((record.fields || {})['所属项目'] ?? ''))
      ].filter((value) => value)
    )
  );

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h2>Astraea <span>Flow</span></h2>
          <div className="app-login-subtitle">UNIFIED COMMAND CENTER</div>
          <form className="form app-login-form" onSubmit={submitLogin}>
            <div>
              <label className="app-login-label">NODE ACCESS KEY</label>
              <input name="username" placeholder="admin / user / 你的账号" required />
            </div>
            <div>
              <label className="app-login-label">SECURITY TOKEN</label>
              <input name="password" type="password" placeholder="***" required />
            </div>
            <button className="btn btn-primary app-login-submit" type="submit">
              INITIALIZE CONNECTION
            </button>
          </form>
          {error && <p className="warn app-login-error">[ERROR]: {error}</p>}
        </div>
      </div>
    );
  }

  return (
    <AstraeaLayout
      currentView={view}
      onViewChange={(newView: ViewKey) => {
        setView(newView);
      }}
      platform={platform}
      onPlatformChange={(mode) => {
        if (mode === 'admin' && !canAccessAdminPlatform) return;
        setPlatform(mode);
        if (mode === 'workspace' && ADMIN_VIEWS.includes(view)) setView('dashboard');
        if (mode === 'admin' && WORKSPACE_VIEWS.includes(view)) setView('audit');
      }}
      canAccessAdmin={canAccessAdminPlatform}
      user={user}
      onLogout={logout}
      unreadCount={notifications.filter((n) => !n.readAt).length}
      theme={theme}
      onThemeChange={setTheme}
    >
      <div className="page-content">
        <div className="app-view-head">
          <h2 className="app-view-title">
            {view === 'dashboard' ? '指挥中心' :
              view === 'requirements' ? '需求流' :
                view === 'costs' ? '成本池' :
                  view === 'schedule' ? '进度轴' :
                    view === 'resources' ? '资源阵列' :
                      view === 'risks' ? '风险雷达' :
                        view === 'feishu' ? '飞书神经元' :
                          view === 'pm-assistant' ? 'PMO 大脑' :
                            view === 'ai' ? 'AI 驱动核心' :
                              view === 'audit' ? '审计轨迹' :
                                view === 'feishu-users' ? '人员映射' :
                                  view === 'global' ? '全局检索' :
                                    view === 'project-access' ? '管理后台 · 项目授权' :
                                      view === 'milestone-board' ? '里程碑看板' :
                                    view === 'settings' ? '系统配置' : ''}
          </h2>
          <div className="app-system-online">
            <span className="app-system-dot"></span>
            SYSTEM.ONLINE
          </div>
        </div>

        {view !== 'dashboard' && view !== 'global' && view !== 'feishu' && view !== 'audit' && view !== 'ai' && view !== 'settings' && view !== 'project-access' && (
          <div className="card app-workspace-card">
            <div className="form app-workspace-form">
              <div>
                <label className="app-workspace-label">目标工作区</label>
                <ThemedSelect
                  value={selectedProjectId == null ? '' : String(selectedProjectId)}
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
                </ThemedSelect>
              </div>
            </div>
            <div className="app-workspace-current">
              <span className="app-workspace-current-label">当前项目：</span> <strong className="app-workspace-current-name">{selectedProjectName}</strong>
            </div>
          </div>
        )}

        {view === 'global' && (
          <div className="card app-global-search-card">
            <div className="form app-global-search-form">
              <input
                placeholder="全局搜索（项目/需求/成本/工时/任务/里程碑/飞书）"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              <button className="btn" type="button" onClick={() => setGlobalSearch('')}>清空</button>
            </div>
          </div>
        )}

        {view === 'global' && globalSearchResults && (
          <div className="card app-global-results-card">
            <div>
              {globalSearchResults.counts.projects > 0 && (
                <div className="app-global-group">
                  <strong>项目 ({globalSearchResults.counts.projects})</strong>
                  <table className="table app-global-table">
                    <thead><tr><th>ID</th><th>名称</th></tr></thead>
                    <tbody>
                      {globalSearchResults.projects.map((p) => (
                        <tr key={`g-p-${p.id}`}>
                          <td>{p.id}</td>
                          <td>{p.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {globalSearchResults.counts.requirements > 0 && (
                <div className="app-global-group">
                  <strong>需求 ({globalSearchResults.counts.requirements})</strong>
                  <table className="table app-global-table">
                    <thead><tr><th>项目-编号</th><th>标题</th><th>状态</th></tr></thead>
                    <tbody>
                      {globalSearchResults.requirements.map((r) => (
                        <tr key={`g-r-${r.id}`}>
                          <td>{`${projects.find((p) => p.id === r.projectId)?.name || `项目${r.projectId}`}-${(r as any).projectSeq ?? r.id}`}</td>
                          <td>{r.title}</td>
                          <td>{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {globalSearchResults.counts.costs > 0 && (
                <div className="app-global-group">
                  <strong>成本 ({globalSearchResults.counts.costs})</strong>
                  <table className="table app-global-table">
                    <thead><tr><th>ID</th><th>类型</th><th>金额</th></tr></thead>
                    <tbody>
                      {globalSearchResults.costs.map((c) => (
                        <tr key={`g-c-${c.id}`}>
                          <td>{c.id}</td>
                          <td>{c.type === 'labor' ? '人力' : c.type === 'outsource' ? '外包' : c.type === 'cloud' ? '云资源' : c.type}</td>
                          <td>{c.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {globalSearchResults.counts.worklogs > 0 && (
                <div className="app-global-group">
                  <strong>工时 ({globalSearchResults.counts.worklogs})</strong>
                  <table className="table app-global-table">
                    <thead><tr><th>ID</th><th>任务</th><th>日期</th></tr></thead>
                    <tbody>
                      {globalSearchResults.worklogs.map((w) => (
                        <tr key={`g-w-${w.id}`}>
                          <td>{w.id}</td>
                          <td>{w.taskTitle || '-'}</td>
                          <td>{w.workedOn}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {globalSearchResults.counts.tasks > 0 && (
                <div className="app-global-group">
                  <strong>任务 ({globalSearchResults.counts.tasks})</strong>
                  <table className="table app-global-table">
                    <thead><tr><th>任务ID</th><th>任务名称</th><th>状态</th></tr></thead>
                    <tbody>
                      {globalSearchResults.tasks.map((t) => (
                        <tr key={`g-t-${t.recordId}`}>
                          <td>{t.任务ID || '-'}</td>
                          <td>{t.任务名称 || '-'}</td>
                          <td>{t.状态 || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {globalSearchResults.counts.milestones > 0 && (
                <div className="app-global-group">
                  <strong>里程碑 ({globalSearchResults.counts.milestones})</strong>
                  <table className="table app-global-table">
                    <thead><tr><th>里程碑ID</th><th>名称</th><th>计划日期</th></tr></thead>
                    <tbody>
                      {globalSearchResults.milestones.map((m) => (
                        <tr key={`g-m-${m.recordId}`}>
                          <td>{m.任务ID || '-'}</td>
                          <td>{m.任务名称 || '-'}</td>
                          <td>{m.开始时间 || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {globalSearchResults.counts.feishu > 0 && (
                <div>
                  <strong>飞书记录 ({globalSearchResults.counts.feishu})</strong>
                  <table className="table table-wrap app-global-table">
                    <thead><tr><th>任务ID</th><th>任务名称</th><th>负责人</th><th>状态</th><th>所属项目</th><th>风险等级</th></tr></thead>
                    <tbody>
                      {globalSearchResults.feishu.map((f) => {
                        const form = mapRecordToForm(f);
                        return (
                          <tr key={`g-f-${f.record_id}`}>
                            <td>{form.任务ID || '-'}</td>
                            <td>{form.任务名称 || '-'}</td>
                            <td>{form.负责人 || '-'}</td>
                            <td>{form.状态 || '-'}</td>
                            <td>{form.所属项目 || '-'}</td>
                            <td>{form.风险等级 || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {Object.values(globalSearchResults.counts).every((count) => count === 0) && (
                <div className="app-global-empty">没有匹配结果。</div>
              )}
            </div>
          </div>
        )}

        {loading && <p>Loading...</p>}
        {message && <p>{message}</p>}
        {error && <p className="warn">{error}</p>}
        {lastRetry && (
          <div className="card app-retry-card">
            <div className="app-retry-row">
              <span className="warn">上次操作失败：{lastRetry.label}</span>
              <button className="btn" type="button" onClick={() => void handleRetry()} disabled={retrying}>
                {retrying ? '重试中...' : '重试'}
              </button>
            </div>
          </div>
        )}
        {!canWrite && <div className="card warn app-readonly-tip">当前角色为只读（viewer），新增与修改操作已禁用。</div>}
        {canWrite && (
          <div className="app-inline-edit-tip">
            提示：双击单元格进入编辑，Enter 保存，ESC 取消。
          </div>
        )}

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
            selectedRequirementIds={selectedRequirementIds}
            onSubmitRequirement={submitRequirement}
            requirementEdit={requirementEdit}
            onSaveRequirement={(req) => void saveInlineRequirementEdit(req)}
            onReviewRequirement={(id, decision) => void reviewRequirementAction(id, decision)}
            onMarkRequirementChanged={(req, input) => void markRequirementChanged(req, input)}
            onShowRequirementChanges={(req) => void toggleRequirementChanges(req)}
            onCloseRequirementChanges={closeRequirementChanges}
            onDeleteRequirement={(req) => void deleteRequirement(req)}
            onDeleteSelectedRequirements={() => void deleteSelectedRequirements()}
            onToggleRequirementSelection={toggleRequirementSelection}
            onSelectAllRequirements={(ids, checked) => setSelectedRequirementIds(checked ? ids : [])}
            onInlineKeyDown={handleInlineKeyDown}
            requirementChanges={requirementChanges}
            selectedRequirementForChanges={selectedRequirementForChanges}
            selectedProjectId={selectedProjectId}
            selectedProjectName={selectedProjectName}
            selectedProjectAlias={selectedProjectAlias}
            onImportSuccess={() => void refreshAll(selectedProjectId)}
          />
        )}

        {view === 'costs' && (
          <CostsView
            canWrite={canWrite}
            costSummary={costSummary}
            costEntries={costEntries}
            worklogs={worklogs}
            selectedCostEntryIds={selectedCostEntryIds}
            onSubmitCost={submitCost}
            onSubmitWorklog={submitWorklog}
            costEdit={costEdit}
            worklogEdit={worklogEdit}
            onSaveCost={(entry) => void saveInlineCostEdit(entry)}
            onSaveWorklog={(worklog) => void saveInlineWorklogEdit(worklog)}
            onDeleteCost={(entry) => void deleteCostEntry(entry)}
            onDeleteSelectedCostEntries={() => void deleteSelectedCostEntries()}
            onToggleCostEntrySelection={toggleCostEntrySelection}
            onSelectAllCostEntries={(ids, checked) => setSelectedCostEntryIds(checked ? ids : [])}
            onDeleteWorklog={(worklog) => void deleteWorklog(worklog)}
            onInlineKeyDown={handleInlineKeyDown}
            feishuUserOptions={feishuUsers.map((u) => u.name)}
          />
        )}

        {view === 'schedule' && (
          <ScheduleView
            canWrite={canWrite}
            tasks={scheduleTasks}
            milestones={scheduleMilestones}
            scheduleLoading={scheduleLoading}
            scheduleError={scheduleError}
            scheduleDependencies={scheduleDependencies}
            scheduleDependenciesError={scheduleDependenciesError}
            riskText={scheduleRiskText}
            onSubmitTask={submitTask}
            onSubmitMilestone={submitMilestone}
            scheduleEdit={scheduleEdit}
            onSaveSchedule={(row) => void saveInlineScheduleEdit(row)}
            onDeleteSchedule={(row) => void deleteScheduleRow(row)}
            onAddDependency={(input) => void addScheduleDependency(input)}
            onRemoveDependency={(id) => void removeScheduleDependency(id)}
            onInlineKeyDown={handleInlineKeyDown}
          />
        )}

        {view === 'resources' && (
          <ResourcesView
            worklogs={worklogs}
            scheduleTasks={scheduleTasks}
            scheduleLoading={scheduleLoading}
            scheduleError={scheduleError}
            selectedProjectName={selectedProjectName}
            users={users}
          />
        )}

        {view === 'milestone-board' && (
          <MilestoneBoardView
            projects={projects}
            feishuUserNames={feishuUsers.map((u) => u.name)}
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => { if (id) void refreshAll(id); }}
          />
        )}

        {view === 'risks' && (
          <RiskCenterView
            data={riskAlerts}
            loading={riskLoading}
            error={riskError}
            message={riskMessage}
            filters={riskFilters}
            rules={riskRules}
            logs={riskRuleLogs}
            projectOptions={riskProjectOptions}
            onChange={updateRiskFilters}
            onUpdateRule={updateRiskRuleLocal}
            onRefresh={() => void loadRiskAlerts()}
            onSaveRule={() => void saveRiskRule()}
            canWrite={canWrite}
          />
        )}

        {view === 'dashboard' && scheduleTasks.length > 0 && (
          <RiskAlertsView rows={scheduleTasks} thresholdDays={7} progressThreshold={80} />
        )}

        {view === 'feishu' && (
          <FeishuView
            canWrite={canWrite}
            feishuForm={feishuForm}
            feishuMessage={feishuMessage}
            feishuError={feishuError}
            feishuLoading={feishuLoading}
            feishuRecords={feishuRecords}
            filteredFeishuRecords={filteredFeishuRecords}
            feishuProjectOptions={feishuProjectOptions}
            feishuUserOptions={feishuUsers.map((u) => u.name)}
            selectedFeishuIds={selectedFeishuIds}
            visibleColumns={feishuVisibleColumns}
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
            onExportFeishu={exportFeishuCsv}
            onImportFeishu={(file) => void importFeishuCsv(file)}
            onToggleColumn={toggleFeishuColumn}
            onPrevPage={goFeishuPrevPage}
            onNextPage={goFeishuNextPage}
            onRemoveFeishu={(record) => void removeFeishuRecord(record)}
            onDeleteSelectedFeishu={() => void removeSelectedFeishuRecords()}
            onToggleFeishuSelection={toggleFeishuSelection}
            onSelectAllFeishu={(ids, checked) => setSelectedFeishuIds(checked ? ids : [])}
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

        {view === 'feishu-users' && (
          <FeishuUsersView canWrite={canWrite} />
        )}

        {view === 'pm-assistant' && (
          <PmAssistantView projectId={selectedProjectId || undefined} />
        )}

        {view === 'ai' && (
          <AiView
            aiReport={aiReport}
            aiReportSource={aiReportSource}
            onGenerate={generateReport}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => { if (id) void refreshAll(id); }}
          />
        )}

        {view === 'notifications' && (
          <NotificationsView
            notifications={notifications}
            onMarkRead={(id) => void markNotificationRead(id)}
            settings={notificationSettings}
            onUpdateSettings={setNotificationSettings}
          />
        )}

        {view === 'audit' && canWrite && (
          <AuditView
            auditLogs={auditLogs}
            chatbotAuditLogs={chatbotAuditLogs}
            onRefresh={() => { void loadAuditLogs(); }}
          />
        )}

        {view === 'settings' && canWrite && (
          <SettingsView onError={setError} onMessage={setMessage} theme={theme} onThemeChange={setTheme} />
        )}

        {view === 'project-access' && canManageAdmin && (
          <ProjectAccessView
            users={users}
            projects={projects}
            canManage={canManageAdmin}
            onError={setError}
            onMessage={setMessage}
            onReloadUsers={async () => {
              await refreshAll(selectedProjectId);
            }}
          />
        )}
      </div>
    </AstraeaLayout>
  );
}

export default App;
