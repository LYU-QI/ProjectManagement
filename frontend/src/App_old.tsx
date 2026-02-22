import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost, TOKEN_KEY, USER_KEY } from './api/client';

type ViewKey = 'dashboard' | 'requirements' | 'costs' | 'schedule' | 'ai' | 'notifications' | 'audit';

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
  const [view, setView] = useState<ViewKey>('dashboard');
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

  async function editProject(project: ProjectItem) {
    if (!canWrite) return;
    setMessage('');
    setError('');
    const name = window.prompt('项目名称', project.name);
    if (name === null) return;
    const budgetRaw = window.prompt('预算', String(project.budget));
    if (budgetRaw === null) return;
    const budget = Number(budgetRaw);
    if (!Number.isFinite(budget) || budget <= 0) {
      setError('预算必须是大于 0 的数字。');
      return;
    }
    const startDate = window.prompt('开始日期(YYYY-MM-DD, 可留空)', project.startDate ?? '');
    if (startDate === null) return;
    const endDate = window.prompt('结束日期(YYYY-MM-DD, 可留空)', project.endDate ?? '');
    if (endDate === null) return;

    try {
      await apiPatch(`/projects/${project.id}`, {
        name,
        budget,
        startDate: startDate || null,
        endDate: endDate || null
      });
      setMessage(`项目「${name}」已更新。`);
      await refreshAll(project.id);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新项目失败。（${detail}）`);
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

  async function editCostEntry(entry: CostEntryItem) {
    if (!canWrite) return;
    setMessage('');
    setError('');
    const type = window.prompt('成本类型(labor/outsource/cloud)', entry.type);
    if (type === null) return;
    if (!['labor', 'outsource', 'cloud'].includes(type)) {
      setError('成本类型只能是 labor/outsource/cloud。');
      return;
    }
    const amountRaw = window.prompt('金额', String(entry.amount));
    if (amountRaw === null) return;
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('金额必须是非负数字。');
      return;
    }
    const occurredOn = window.prompt('发生日期(YYYY-MM-DD)', entry.occurredOn);
    if (occurredOn === null) return;
    const note = window.prompt('备注', entry.note ?? '');
    if (note === null) return;

    try {
      await apiPatch(`/cost-entries/${entry.id}`, {
        type,
        amount,
        occurredOn,
        note
      });
      setMessage(`成本条目 #${entry.id} 已更新。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新成本失败。（${detail}）`);
    }
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

  async function editWorklog(worklog: Worklog) {
    if (!canWrite) return;
    setMessage('');
    setError('');
    const taskTitle = window.prompt('工时任务', worklog.taskTitle ?? '');
    if (taskTitle === null) return;
    const hoursRaw = window.prompt('工时(小时)', String(worklog.hours));
    if (hoursRaw === null) return;
    const hours = Number(hoursRaw);
    if (!Number.isFinite(hours) || hours <= 0) {
      setError('工时必须是大于 0 的数字。');
      return;
    }
    const hourlyRateRaw = window.prompt('时薪', String(worklog.hourlyRate));
    if (hourlyRateRaw === null) return;
    const hourlyRate = Number(hourlyRateRaw);
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      setError('时薪必须是非负数字。');
      return;
    }
    const workedOn = window.prompt('工作日期(YYYY-MM-DD)', worklog.workedOn);
    if (workedOn === null) return;
    const note = window.prompt('备注', worklog.note ?? '');
    if (note === null) return;

    try {
      await apiPatch(`/worklogs/${worklog.id}`, {
        taskTitle,
        hours,
        hourlyRate,
        workedOn,
        note
      });
      setMessage(`工时 #${worklog.id} 已更新。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新工时失败。（${detail}）`);
    }
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

  async function editMilestone(milestone: ScheduleData['milestones'][number]) {
    if (!canWrite) return;
    setMessage('');
    setError('');
    const name = window.prompt('里程碑名称', milestone.name);
    if (name === null) return;
    const plannedDate = window.prompt('计划日期(YYYY-MM-DD)', milestone.plannedDate);
    if (plannedDate === null) return;
    const actualDate = window.prompt('实际日期(YYYY-MM-DD, 可留空)', milestone.actualDate ?? '');
    if (actualDate === null) return;

    try {
      await apiPatch(`/projects/milestones/${milestone.id}`, {
        name,
        plannedDate,
        actualDate: actualDate || null
      });
      setMessage(`里程碑 #${milestone.id} 已更新。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新里程碑失败。（${detail}）`);
    }
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

  async function editTask(task: ScheduleData['tasks'][number]) {
    if (!canWrite) return;
    setMessage('');
    setError('');
    const title = window.prompt('任务标题', task.title);
    if (title === null) return;
    const assignee = window.prompt('负责人', task.assignee);
    if (assignee === null) return;
    const status = window.prompt('状态(todo/in_progress/blocked/done)', task.status);
    if (status === null) return;
    if (!['todo', 'in_progress', 'blocked', 'done'].includes(status)) {
      setError('状态只能是 todo/in_progress/blocked/done。');
      return;
    }
    const plannedStart = window.prompt('计划开始(YYYY-MM-DD)', task.plannedStart);
    if (plannedStart === null) return;
    const plannedEnd = window.prompt('计划结束(YYYY-MM-DD)', task.plannedEnd);
    if (plannedEnd === null) return;

    try {
      await apiPatch(`/projects/tasks/${task.id}`, {
        title,
        assignee,
        status,
        plannedStart,
        plannedEnd
      });
      setMessage(`任务 #${task.id} 已更新。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新任务失败。（${detail}）`);
    }
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

  async function editRequirement(req: Requirement) {
    if (!canWrite) return;
    setMessage('');
    setError('');
    const title = window.prompt('需求标题', req.title);
    if (title === null) return;
    const description = window.prompt('需求描述', req.description);
    if (description === null) return;
    const priority = window.prompt('优先级(low/medium/high)', req.priority);
    if (priority === null) return;
    if (!['low', 'medium', 'high'].includes(priority)) {
      setError('优先级只能是 low/medium/high。');
      return;
    }
    const status = window.prompt('状态(draft/in_review/approved/planned/done)', req.status);
    if (status === null) return;
    if (!['draft', 'in_review', 'approved', 'planned', 'done'].includes(status)) {
      setError('状态只能是 draft/in_review/approved/planned/done。');
      return;
    }

    try {
      await apiPatch(`/requirements/${req.id}`, {
        title,
        description,
        priority,
        status
      });
      setMessage(`需求 #${req.id} 已更新。`);
      await refreshAll(selectedProjectId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新需求失败。（${detail}）`);
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
                    <tr key={project.id}>
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
                      <td>{project.name}</td>
                      <td>{project.budget}</td>
                      <td>{project.startDate || '-'}</td>
                      <td>{project.endDate || '-'}</td>
                      {canWrite && (
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="btn" type="button" onClick={() => void editProject(project)}>编辑</button>
                          <button className="btn" type="button" onClick={() => void deleteProject(project)}>删除</button>
                        </td>
                      )}
                    </tr>
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
                <thead><tr><th>ID</th><th>标题</th><th>优先级</th><th>状态</th><th>变更次数</th>{canWrite && <th>操作</th>}</tr></thead>
                <tbody>
                  {requirements.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.title}</td>
                      <td>{r.priority}</td>
                      <td>{r.status}</td>
                      <td>{r.changeCount}</td>
                      {canWrite && (
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="btn" type="button" onClick={() => void editRequirement(r)}>编辑</button>
                          <button className="btn" type="button" onClick={() => void reviewRequirementAction(r.id, 'approved')}>通过</button>
                          <button className="btn" type="button" onClick={() => void reviewRequirementAction(r.id, 'rejected')}>驳回</button>
                          <button className="btn" type="button" onClick={() => void markRequirementChanged(r)}>记变更</button>
                          <button className="btn" type="button" onClick={() => void deleteRequirement(r)}>删除</button>
                        </td>
                      )}
                    </tr>
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
                    <tr key={entry.id}>
                      <td>{entry.id}</td>
                      <td>{entry.type}</td>
                      <td>{entry.amount}</td>
                      <td>{entry.occurredOn}</td>
                      <td>{entry.note || '-'}</td>
                      {canWrite && (
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="btn" type="button" onClick={() => void editCostEntry(entry)}>编辑</button>
                          <button className="btn" type="button" onClick={() => void deleteCostEntry(entry)}>删除</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <h3>工时明细</h3>
              <table className="table">
                <thead><tr><th>日期</th><th>任务</th><th>工时</th><th>时薪</th><th>成本</th>{canWrite && <th>操作</th>}</tr></thead>
                <tbody>
                  {worklogs.map((w) => (
                    <tr key={w.id}>
                      <td>{w.workedOn}</td>
                      <td>{w.taskTitle || '-'}</td>
                      <td>{w.hours}</td>
                      <td>{w.hourlyRate}</td>
                      <td>{(w.hours * w.hourlyRate).toFixed(2)}</td>
                      {canWrite && (
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="btn" type="button" onClick={() => void editWorklog(w)}>编辑</button>
                          <button className="btn" type="button" onClick={() => void deleteWorklog(w)}>删除</button>
                        </td>
                      )}
                    </tr>
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
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>{t.assignee}</td>
                      <td>{t.status}</td>
                      <td>{t.plannedStart}</td>
                      <td>{t.plannedEnd}</td>
                      {canWrite && (
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="btn" type="button" onClick={() => void editTask(t)}>编辑</button>
                          <button className="btn" type="button" onClick={() => void deleteTask(t)}>删除</button>
                        </td>
                      )}
                    </tr>
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
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{m.plannedDate}</td>
                      <td>{m.actualDate || '-'}</td>
                      {canWrite && (
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="btn" type="button" onClick={() => void editMilestone(m)}>编辑</button>
                          <button className="btn" type="button" onClick={() => void deleteMilestone(m)}>删除</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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
