import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import ThemedSelect from '../components/ui/ThemedSelect';
import { createWorkItem, deleteWorkItem, getWorkItemHistory, listWorkItems, updateWorkItem } from '../api/work-items';
import type { ProjectItem, UserItem, WorkItem, WorkItemHistory } from '../types';

type Props = {
  canWrite: boolean;
  projects: ProjectItem[];
  users: UserItem[];
  feishuUserNames: string[];
  selectedProjectId: number | null;
};

type WorkItemStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';
type Scope = 'all' | 'project' | 'personal';

const STATUS_OPTIONS: { value: WorkItemStatus; label: string }[] = [
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'in_review', label: '审核中' },
  { value: 'done', label: '已完成' },
  { value: 'closed', label: '已关闭' },
];

const STATUS_LABELS: Record<WorkItemStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  in_review: '审核中',
  done: '已完成',
  closed: '已关闭',
};

const PAGE_SIZE = 20;

export default function WorkItemsView({ canWrite, projects, users, feishuUserNames, selectedProjectId }: Props) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [scope, setScope] = useState<Scope>('all');
  const [status, setStatus] = useState<WorkItemStatus>('todo');
  const [type, setType] = useState<'' | 'todo' | 'issue'>('');
  const [priority, setPriority] = useState<'' | 'low' | 'medium' | 'high'>('');
  const [assigneeNameFilter, setAssigneeNameFilter] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<WorkItem | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [historyOf, setHistoryOf] = useState<WorkItem | null>(null);
  const [histories, setHistories] = useState<WorkItemHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionMenuRowId, setActionMenuRowId] = useState<number | null>(null);

  const [form, setForm] = useState({
    scope: 'project' as 'project' | 'personal',
    projectId: selectedProjectId ?? 0,
    title: '',
    description: '',
    type: 'todo' as 'todo' | 'issue',
    priority: 'medium' as 'low' | 'medium' | 'high',
    assigneeName: '',
    dueDate: ''
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const userMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const user of users) {
      map.set(user.id, user.name);
    }
    return map;
  }, [users]);

  const feishuNameOptions = useMemo(() => {
    return Array.from(new Set(feishuUserNames.map((name) => String(name || '').trim()).filter(Boolean)));
  }, [feishuUserNames]);

  const formFeishuOptions = useMemo(() => {
    if (!form.assigneeName) return feishuNameOptions;
    if (feishuNameOptions.includes(form.assigneeName)) return feishuNameOptions;
    return [...feishuNameOptions, form.assigneeName];
  }, [form.assigneeName, feishuNameOptions]);

  const canUsePortal = typeof window !== 'undefined' && typeof document !== 'undefined';

  async function load(opts?: { page?: number }) {
    const nextPage = opts?.page ?? page;
    setLoading(true);
    setError('');
    try {
      const res = await listWorkItems({
        projectId: selectedProjectId ?? undefined,
        scope,
        status,
        type: type || undefined,
        priority: priority || undefined,
        assigneeName: assigneeNameFilter || undefined,
        search: search || undefined,
        page: nextPage,
        pageSize: PAGE_SIZE
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
      if (page !== nextPage) {
        setPage(nextPage);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`加载 Todo/问题失败。（${detail}）`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [scope, status, type, priority, assigneeNameFilter, page, selectedProjectId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      projectId: selectedProjectId ?? prev.projectId,
      scope: selectedProjectId ? 'project' : prev.scope
    }));
  }, [selectedProjectId]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.req-action-menu')) {
        setActionMenuRowId(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  function openCreate() {
    setEditing(null);
    const defaultAssignee = feishuNameOptions[0] || '';
    setForm({
      scope: selectedProjectId ? 'project' : 'personal',
      projectId: selectedProjectId ?? 0,
      title: '',
      description: '',
      type: 'todo',
      priority: 'medium',
      assigneeName: defaultAssignee,
      dueDate: ''
    });
    setShowEditor(true);
  }

  function openEdit(item: WorkItem) {
    setEditing(item);
    setForm({
      scope: item.projectId ? 'project' : 'personal',
      projectId: item.projectId ?? selectedProjectId ?? 0,
      title: item.title,
      description: item.description || '',
      type: item.type,
      priority: item.priority,
      assigneeName: item.assigneeName || item.assignee?.name || '',
      dueDate: item.dueDate || ''
    });
    setShowEditor(true);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setMessage('');
    const assigneeName = form.assigneeName.trim();
    if (form.scope === 'project' && !form.projectId) {
      setError('项目项必须选择项目。');
      return;
    }
    if (!assigneeName) {
      setError('请选择负责人（飞书成员）。');
      return;
    }
    const mappedAssignee = users.find((user) => user.name === assigneeName);

    try {
      if (editing) {
        await updateWorkItem(editing.id, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          type: form.type,
          priority: form.priority,
          assigneeId: mappedAssignee?.id ?? null,
          assigneeName,
          dueDate: form.dueDate || null
        });
        setMessage('工作项已更新。');
      } else {
        const created = await createWorkItem({
          projectId: form.scope === 'project' ? form.projectId : undefined,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          type: form.type,
          priority: form.priority,
          assigneeId: mappedAssignee?.id,
          assigneeName,
          dueDate: form.dueDate || undefined
        });
        setMessage('工作项已创建。');
        // 快速回显：在第一页且筛选命中时，先本地插入一条，再后台刷新一次确保排序/总数准确。
        const matchesCurrentFilters =
          (scope === 'all' || (scope === 'project' ? Boolean(created.projectId) : !created.projectId)) &&
          created.status === status &&
          (!type || created.type === type) &&
          (!priority || created.priority === priority) &&
          (!assigneeNameFilter || (created.assigneeName || created.assignee?.name || '') === assigneeNameFilter) &&
          (!search || `${created.title} ${created.description || ''}`.toLowerCase().includes(search.toLowerCase()));
        if (page === 1 && matchesCurrentFilters) {
          setItems((prev) => [created, ...prev].slice(0, PAGE_SIZE));
          setTotal((prev) => prev + 1);
        }
      }
      setShowEditor(false);
      setEditing(null);
      await load({ page: 1 });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`保存失败。（${detail}）`);
    }
  }

  async function setItemStatus(item: WorkItem, newStatus: WorkItemStatus) {
    if (!canWrite) return;
    setError('');
    setMessage('');
    try {
      await updateWorkItem(item.id, { status: newStatus });
      setMessage(`状态已更新为「${STATUS_LABELS[newStatus]}」。`);
      await load();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`更新状态失败。（${detail}）`);
    }
  }

  async function remove(item: WorkItem) {
    if (!canWrite) return;
    if (!window.confirm(`确定删除「${item.title}」？`)) return;
    setError('');
    setMessage('');
    try {
      await deleteWorkItem(item.id);
      setMessage('工作项已删除。');
      await load();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`删除失败。（${detail}）`);
    }
  }

  async function openHistory(item: WorkItem) {
    setHistoryOf(item);
    setHistoryLoading(true);
    setHistories([]);
    try {
      const rows = await getWorkItemHistory(item.id);
      setHistories(rows || []);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setError(`加载历史失败。（${detail}）`);
    } finally {
      setHistoryLoading(false);
    }
  }

  function renderHistoryValue(field: WorkItemHistory['field'], value?: string | null) {
    if (value == null || value === '') return '-';
    if (field === 'assignee') {
      const id = Number(value);
      if (Number.isFinite(id) && userMap.has(id)) return `${userMap.get(id)} (#${id})`;
    }
    if (field === 'status') {
      return STATUS_LABELS[value as WorkItemStatus] || value;
    }
    return value;
  }

  return (
    <div className="card workitems-page">
      <div className="table-toolbar workitems-toolbar">
        <div className="workitems-filters-grid">
          <div className="workitems-filter-item">
            <ThemedSelect value={scope} onChange={(e) => { setScope(e.target.value as Scope); setPage(1); }}>
              <option value="all">全部范围</option>
              <option value="project">项目项</option>
              <option value="personal">个人项</option>
            </ThemedSelect>
          </div>
          <div className="workitems-filter-item">
            <ThemedSelect value={status} onChange={(e) => { setStatus(e.target.value as WorkItemStatus); setPage(1); }}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </ThemedSelect>
          </div>
          <div className="workitems-filter-item">
            <ThemedSelect value={type} onChange={(e) => { setType(e.target.value as '' | 'todo' | 'issue'); setPage(1); }}>
              <option value="">全部类型</option>
              <option value="todo">Todo</option>
              <option value="issue">Issue</option>
            </ThemedSelect>
          </div>
          <div className="workitems-filter-item">
            <ThemedSelect value={priority} onChange={(e) => { setPriority(e.target.value as '' | 'low' | 'medium' | 'high'); setPage(1); }}>
              <option value="">全部优先级</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </ThemedSelect>
          </div>
          <div className="workitems-filter-item">
            <ThemedSelect value={assigneeNameFilter} onChange={(e) => { setAssigneeNameFilter(e.target.value); setPage(1); }}>
              <option value="">全部负责人</option>
              {feishuNameOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </ThemedSelect>
          </div>
          <div className="workitems-search-row">
            <input
              value={search}
              placeholder="搜索标题/描述"
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {canWrite && <button className="btn btn-primary" type="button" onClick={openCreate}>新增</button>}
          </div>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {message && <p>{message}</p>}
      {error && <p className="warn">{error}</p>}

      <div className="workitems-table-wrap">
        <table className="table table-wrap">
          <thead>
            <tr>
              <th>状态</th>
              <th>标题</th>
              <th>类型</th>
              <th>优先级</th>
              <th>负责人</th>
              <th>截止日期</th>
              <th>归属</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8}>暂无记录</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <select
                    className={`status-badge status-${item.status}`}
                    value={item.status}
                    onChange={(e) => void setItemStatus(item, e.target.value as WorkItemStatus)}
                    disabled={!canWrite}
                    style={{ cursor: canWrite ? 'pointer' : 'default', border: 'none', background: 'transparent', fontSize: 'inherit' }}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <strong>{item.title}</strong>
                  {item.description ? <div className="text-secondary">{item.description}</div> : null}
                </td>
                <td>{item.type === 'todo' ? 'Todo' : 'Issue'}</td>
                <td>{item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}</td>
                <td>{item.assignee?.name || item.assigneeName || '-'}</td>
                <td>{item.dueDate || '-'}</td>
                <td>{item.project?.name || '个人'}</td>
                <td className="operation-cell">
                  <div className="req-action-menu">
                    <button
                      className="btn req-action-trigger"
                      type="button"
                      onClick={() => setActionMenuRowId((prev) => (prev === item.id ? null : item.id))}
                    >
                      操作 <span className="req-action-caret">{actionMenuRowId === item.id ? '▴' : '▾'}</span>
                    </button>
                    {actionMenuRowId === item.id && (
                      <div className="req-action-dropdown">
                        <button className="btn req-action-item" type="button" onClick={() => { setActionMenuRowId(null); void openHistory(item); }}>历史</button>
                        {canWrite && <button className="btn req-action-item" type="button" onClick={() => { setActionMenuRowId(null); openEdit(item); }}>编辑</button>}
                        {canWrite && <button className="btn req-action-item danger" type="button" onClick={() => { setActionMenuRowId(null); void remove(item); }}>删除</button>}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel-actions workitems-pagination">
        <button className="btn" type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
        <span>第 {page} / {totalPages} 页，记录数 {total}</span>
        <button className="btn" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
      </div>

      {showEditor && canUsePortal && createPortal(
        <div className="req-modal-backdrop" onClick={() => setShowEditor(false)}>
          <div className="req-modal" onClick={(e) => e.stopPropagation()}>
            <div className="req-modal-head">
              <h3>{editing ? '编辑工作项' : '新增工作项'}</h3>
              <div className="workitems-modal-head-actions">
                <button className="btn btn-primary" form="workitems-editor-form" type="submit">
                  {editing ? '保存' : '创建'}
                </button>
                <button className="btn" type="button" onClick={() => setShowEditor(false)}>关闭</button>
              </div>
            </div>
            <form id="workitems-editor-form" className="workitems-editor-form" onSubmit={submit}>
              <div className="workitems-editor-row1">
                <div className="workitems-field">
                  <label>归属</label>
                  <ThemedSelect value={form.scope} onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as 'project' | 'personal' }))}>
                    <option value="project">项目项</option>
                    <option value="personal">个人项</option>
                  </ThemedSelect>
                </div>
                {form.scope === 'project' && (
                  <div className="workitems-field">
                    <label>项目</label>
                    <ThemedSelect value={String(form.projectId || '')} onChange={(e) => setForm((prev) => ({ ...prev, projectId: Number(e.target.value) || 0 }))}>
                      <option value="">请选择项目</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name} (#{project.id})</option>
                      ))}
                    </ThemedSelect>
                  </div>
                )}
                <div className="workitems-field">
                  <label>标题</label>
                  <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required />
                </div>
                <div className="workitems-field">
                  <label>类型</label>
                  <ThemedSelect value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as 'todo' | 'issue' }))}>
                    <option value="todo">Todo</option>
                    <option value="issue">Issue</option>
                  </ThemedSelect>
                </div>
              </div>

              <div className="workitems-editor-row2">
                <div className="workitems-field workitems-editor-description">
                  <label>描述</label>
                  <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <div className="workitems-side-stack">
                  <div className="workitems-field">
                    <label>优先级</label>
                    <ThemedSelect value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}>
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </ThemedSelect>
                  </div>
                  <div className="workitems-field">
                    <label>负责人</label>
                    <ThemedSelect value={form.assigneeName} onChange={(e) => setForm((prev) => ({ ...prev, assigneeName: e.target.value }))} required>
                      <option value="" disabled hidden>{formFeishuOptions.length > 0 ? '请选择负责人（飞书成员）' : '暂无飞书成员'}</option>
                      {formFeishuOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </ThemedSelect>
                  </div>
                  <div className="workitems-field">
                    <label>截止日期</label>
                    <input type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {historyOf && canUsePortal && createPortal(
        <div className="req-modal-backdrop" onClick={() => setHistoryOf(null)}>
          <div className="req-modal" onClick={(e) => e.stopPropagation()}>
            <div className="req-modal-head">
              <h3>变更历史 · {historyOf.title}</h3>
              <button className="btn" type="button" onClick={() => setHistoryOf(null)}>关闭</button>
            </div>
            {historyLoading ? <p>Loading...</p> : (
              <table className="table table-wrap">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>字段</th>
                    <th>变更前</th>
                    <th>变更后</th>
                    <th>操作人</th>
                  </tr>
                </thead>
                <tbody>
                  {histories.length === 0 && (
                    <tr><td colSpan={5}>暂无历史</td></tr>
                  )}
                  {histories.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>{entry.field === 'status' ? '状态' : entry.field === 'assignee' ? '负责人' : entry.field === 'dueDate' ? '截止日期' : '描述'}</td>
                      <td>{renderHistoryValue(entry.field, entry.beforeValue)}</td>
                      <td>{renderHistoryValue(entry.field, entry.afterValue)}</td>
                      <td>{entry.changedBy?.name || `#${entry.changedById}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
