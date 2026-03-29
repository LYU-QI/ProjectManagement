import { useEffect, useMemo, useState } from 'react';
import ThemedSelect from '../components/ui/ThemedSelect';
import {
  createBug, deleteBug, listBugs, updateBug,
  type Bug, type BugStatus, type BugSeverity, type BugPriority
} from '../api/testhub';

type Props = {
  selectedProjectId: number | null;
  canWrite: boolean;
  feishuUserNames: string[];
};

const STATUS_OPTIONS: { value: BugStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'open', label: '待处理' },
  { value: 'in_progress', label: '处理中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
  { value: 'rejected', label: '已驳回' },
];

const STATUS_LABELS: Record<BugStatus, string> = {
  open: '待处理',
  in_progress: '处理中',
  resolved: '已解决',
  closed: '已关闭',
  rejected: '已驳回',
};

const SEVERITY_OPTIONS: { value: BugSeverity | ''; label: string }[] = [
  { value: '', label: '全部严重' },
  { value: 'blocker', label: 'Blocker' },
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'trivial', label: 'Trivial' },
];

const PRIORITY_OPTIONS: { value: BugPriority | ''; label: string }[] = [
  { value: '', label: '全部优先级' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const SEVERITY_LABELS: Record<BugSeverity, string> = {
  blocker: 'Blocker', critical: 'Critical', major: 'Major', minor: 'Minor', trivial: 'Trivial'
};

const PRIORITY_LABELS: Record<BugPriority, string> = {
  urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low'
};

const STATUS_COLOR: Record<BugStatus, string> = {
  open: '#ef4444', in_progress: '#f59e0b', resolved: '#10b981', closed: '#6b7280', rejected: '#9ca3af'
};
const SEVERITY_COLOR: Record<BugSeverity, string> = {
  blocker: '#dc2626', critical: '#ea580c', major: '#d97706', minor: '#65a30d', trivial: '#94a3b8'
};

const PAGE_SIZE = 20;

export default function BugView({ selectedProjectId, canWrite, feishuUserNames }: Props) {
  const [items, setItems] = useState<Bug[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [statusFilter, setStatusFilter] = useState<BugStatus | ''>('');
  const [severityFilter, setSeverityFilter] = useState<BugSeverity | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<BugPriority | ''>('');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editingBug, setEditingBug] = useState<Bug | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    steps: '',
    severity: 'major' as BugSeverity,
    priority: 'medium' as BugPriority,
    assigneeName: ''
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const userNameOptions = useMemo(() => {
    return Array.from(new Set(feishuUserNames.map(n => String(n || '').trim()).filter(Boolean)));
  }, [feishuUserNames]);

  const formNameOptions = useMemo(() => {
    if (!form.assigneeName) return userNameOptions;
    if (userNameOptions.includes(form.assigneeName)) return userNameOptions;
    return [...userNameOptions, form.assigneeName];
  }, [form.assigneeName, userNameOptions]);

  async function load(p = 1) {
    if (!selectedProjectId) {
      setItems([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await listBugs({
        projectId: selectedProjectId,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        priority: priorityFilter || undefined,
        search: search || undefined,
        page: p,
        pageSize: PAGE_SIZE
      });
      setItems(res.items);
      setTotal(res.total);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
  }, [selectedProjectId, statusFilter, severityFilter, priorityFilter, search]);

  function openCreate() {
    setEditingBug(null);
    setForm({ title: '', description: '', steps: '', severity: 'major', priority: 'medium', assigneeName: '' });
    setShowCreate(true);
  }

  function openEdit(bug: Bug) {
    setShowCreate(false);
    setEditingBug(bug);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) return;
    if (!form.title.trim()) {
      setError('标题不能为空');
      return;
    }
    setError('');
    setMessage('');
    try {
      if (editingBug) {
        await updateBug(editingBug.id, {
          title: form.title,
          description: form.description || null,
          steps: form.steps || null,
          severity: form.severity,
          priority: form.priority,
          assigneeName: form.assigneeName || null
        });
        setMessage('Bug 已更新');
      } else {
        await createBug({
          projectId: selectedProjectId,
          title: form.title,
          description: form.description || undefined,
          steps: form.steps || undefined,
          severity: form.severity,
          priority: form.priority,
          assigneeName: form.assigneeName || undefined
        });
        setMessage('Bug 已创建');
      }
      setShowCreate(false);
      setEditingBug(null);
      void load(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    }
  }

  async function handleStatusChange(bug: Bug, status: BugStatus) {
    try {
      await updateBug(bug.id, { status });
      setItems(prev => prev.map(b => b.id === bug.id ? { ...b, status } : b));
      setMessage('状态已更新');
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
    }
  }

  async function handleDelete(bug: Bug) {
    if (!window.confirm(`确定删除 Bug「${bug.title}」？`)) return;
    try {
      await deleteBug(bug.id);
      setMessage('Bug 已删除');
      void load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <ThemedSelect value={statusFilter} onChange={e => { setStatusFilter(e.target.value as BugStatus | ''); }}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </ThemedSelect>
        <ThemedSelect value={severityFilter} onChange={e => { setSeverityFilter(e.target.value as BugSeverity | ''); }}>
          {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </ThemedSelect>
        <ThemedSelect value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value as BugPriority | ''); }}>
          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </ThemedSelect>
        <input
          className="glass-input"
          placeholder="搜索标题..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
        {canWrite && selectedProjectId && (
          <button className="btn primary" onClick={openCreate}>+ 新建 Bug</button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && canWrite && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '0.75rem', borderColor: 'var(--color-primary)', border: '1px solid var(--color-border-strong)' }}>
          <h3 style={{ marginBottom: '1rem' }}>新建 Bug</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>标题 *</label>
                <input className="glass-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>负责人</label>
                <input
                  className="glass-input"
                  list="bug-assignee-options"
                  value={form.assigneeName}
                  onChange={e => setForm(f => ({ ...f, assigneeName: e.target.value }))}
                />
                <datalist id="bug-assignee-options">
                  {formNameOptions.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>严重性</label>
                <ThemedSelect value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as BugSeverity }))}>
                  {SEVERITY_OPTIONS.filter(o => o.value).map(o => <option key={o.value!} value={o.value}>{o.label}</option>)}
                </ThemedSelect>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>优先级</label>
                <ThemedSelect value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as BugPriority }))}>
                  {PRIORITY_OPTIONS.filter(o => o.value).map(o => <option key={o.value!} value={o.value}>{o.label}</option>)}
                </ThemedSelect>
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>描述</label>
              <textarea className="glass-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>复现步骤</label>
              <textarea className="glass-input" rows={2} value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn primary">{loading ? '提交中...' : '提交'}</button>
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Panel */}
      {editingBug && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '0.75rem', borderColor: 'var(--color-primary)' }}>
          <h3 style={{ marginBottom: '1rem' }}>编辑 Bug #{editingBug.id}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>标题 *</label>
                <input className="glass-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>负责人</label>
                <input
                  className="glass-input"
                  list="bug-assignee-options-edit"
                  value={form.assigneeName}
                  onChange={e => setForm(f => ({ ...f, assigneeName: e.target.value }))}
                />
                <datalist id="bug-assignee-options-edit">
                  {formNameOptions.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>严重性</label>
                <ThemedSelect value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as BugSeverity }))}>
                  {SEVERITY_OPTIONS.filter(o => o.value).map(o => <option key={o.value!} value={o.value}>{o.label}</option>)}
                </ThemedSelect>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>优先级</label>
                <ThemedSelect value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as BugPriority }))}>
                  {PRIORITY_OPTIONS.filter(o => o.value).map(o => <option key={o.value!} value={o.value}>{o.label}</option>)}
                </ThemedSelect>
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>描述</label>
              <textarea className="glass-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn primary">保存</button>
              <button type="button" className="btn" onClick={() => setEditingBug(null)}>取消</button>
            </div>
          </form>
        </div>
      )}

      {error && <div className="card warn" style={{ marginBottom: '0.75rem', padding: '0.75rem' }}>{error}</div>}
      {message && <div className="card" style={{ marginBottom: '0.75rem', padding: '0.75rem', borderColor: 'var(--color-primary)' }}>{message}</div>}

      {/* Table */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>加载中...</div>
      ) : !selectedProjectId ? (
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>请先选择一个项目</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>暂无 Bug</div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>标题</th>
                <th>状态</th>
                <th>严重性</th>
                <th>优先级</th>
                <th>负责人</th>
                <th>报告人</th>
                <th>创建时间</th>
                {canWrite && <th>操作</th>}
              </tr>
            </thead>
            <tbody>
              {items.map(bug => (
                <tr key={bug.id} style={{ cursor: 'pointer' }} onClick={() => canWrite && openEdit(bug)}>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>#{bug.id}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{bug.title}</div>
                    {bug.testCase && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>关联用例: {bug.testCase.title}</div>
                    )}
                  </td>
                  <td>
                    {canWrite ? (
                      <ThemedSelect
                        value={bug.status}
                        onChange={e => { e.stopPropagation(); void handleStatusChange(bug, e.target.value as BugStatus); }}
                        style={{ color: STATUS_COLOR[bug.status], fontWeight: 600 }}
                      >
                        {STATUS_OPTIONS.filter(o => o.value).map(o => (
                          <option key={o.value!} value={o.value}>{o.label}</option>
                        ))}
                      </ThemedSelect>
                    ) : (
                      <span style={{ color: STATUS_COLOR[bug.status], fontWeight: 600 }}>{STATUS_LABELS[bug.status]}</span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: SEVERITY_COLOR[bug.severity], fontWeight: 600, fontSize: '0.8rem' }}>
                      {SEVERITY_LABELS[bug.severity]}
                    </span>
                  </td>
                  <td>
                    <span style={{ opacity: 0.8 }}>{PRIORITY_LABELS[bug.priority]}</span>
                  </td>
                  <td>{bug.assigneeName || '-'}</td>
                  <td>{bug.reporterName || '-'}</td>
                  <td style={{ fontSize: '0.8rem', opacity: 0.6 }}>{new Date(bug.createdAt).toLocaleDateString('zh-CN')}</td>
                  {canWrite && (
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        className="btn"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                        onClick={() => void handleDelete(bug)}
                      >
                        删除
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}>
              <button className="btn" disabled={page <= 1} onClick={() => void load(page - 1)}>上一页</button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', opacity: 0.7 }}>
                第 {page} / {totalPages} 页，共 {total} 条
              </span>
              <button className="btn" disabled={page >= totalPages} onClick={() => void load(page + 1)}>下一页</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
