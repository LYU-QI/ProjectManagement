import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStatePanel from '../components/AsyncStatePanel';
import ThemedSelect from '../components/ui/ThemedSelect';
import {
  createBug, deleteBug, exportBugs, importBugs, listBugs, updateBug,
  type Bug, type BugStatus, type BugSeverity, type BugPriority, type BugImportResult
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
  { value: 'blocker', label: '阻断' },
  { value: 'critical', label: '严重' },
  { value: 'major', label: '主要' },
  { value: 'minor', label: '次要' },
  { value: 'trivial', label: '轻微' },
];

const PRIORITY_OPTIONS: { value: BugPriority | ''; label: string }[] = [
  { value: '', label: '全部优先级' },
  { value: 'urgent', label: '紧急' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

const SEVERITY_LABELS: Record<BugSeverity, string> = {
  blocker: '阻断', critical: '严重', major: '主要', minor: '次要', trivial: '轻微'
};

const PRIORITY_LABELS: Record<BugPriority, string> = {
  urgent: '紧急', high: '高', medium: '中', low: '低'
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
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lastImportResult, setLastImportResult] = useState<BugImportResult | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [statusFilter, setStatusFilter] = useState<BugStatus | ''>('');
  const [severityFilter, setSeverityFilter] = useState<BugSeverity | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<BugPriority | ''>('');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editingBug, setEditingBug] = useState<Bug | null>(null);
  const emptyForm = {
    title: '',
    description: '',
    steps: '',
    clientContext: '',
    memoryContext: '',
    expectedResult: '',
    actualResult: '',
    targetPerson: '',
    requestId: '',
    fixStatus: '',
    issueCreatedAt: new Date().toISOString().slice(0, 10),
    lastModifiedAt: new Date().toISOString().slice(0, 10),
    severity: 'major' as BugSeverity,
    priority: 'medium' as BugPriority,
    assigneeName: ''
  };
  const [form, setForm] = useState(emptyForm);

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
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...emptyForm, issueCreatedAt: today, lastModifiedAt: today });
    setShowCreate(true);
  }

  function openEdit(bug: Bug) {
    setShowCreate(false);
    setEditingBug(bug);
    setForm({
      title: bug.title || '',
      description: bug.description || '',
      steps: bug.steps || '',
      clientContext: bug.clientContext || '',
      memoryContext: bug.memoryContext || '',
      expectedResult: bug.expectedResult || '',
      actualResult: bug.actualResult || '',
      targetPerson: bug.targetPerson || '',
      requestId: bug.requestId || '',
      fixStatus: bug.fixStatus || '',
      issueCreatedAt: bug.issueCreatedAt || new Date(bug.createdAt).toISOString().slice(0, 10),
      lastModifiedAt: bug.lastModifiedAt || new Date(bug.updatedAt).toISOString().slice(0, 10),
      severity: bug.severity,
      priority: bug.priority,
      assigneeName: bug.assigneeName || ''
    });
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
          clientContext: form.clientContext || null,
          memoryContext: form.memoryContext || null,
          expectedResult: form.expectedResult || null,
          actualResult: form.actualResult || null,
          targetPerson: form.targetPerson || null,
          requestId: form.requestId || null,
          fixStatus: form.fixStatus || null,
          issueCreatedAt: form.issueCreatedAt || null,
          lastModifiedAt: form.lastModifiedAt || null,
          severity: form.severity,
          priority: form.priority,
          assigneeName: form.assigneeName || null
        });
        setMessage('缺陷已更新');
      } else {
        await createBug({
          projectId: selectedProjectId,
          title: form.title,
          description: form.description || undefined,
          steps: form.steps || undefined,
          clientContext: form.clientContext || undefined,
          memoryContext: form.memoryContext || undefined,
          expectedResult: form.expectedResult || undefined,
          actualResult: form.actualResult || undefined,
          targetPerson: form.targetPerson || undefined,
          requestId: form.requestId || undefined,
          fixStatus: form.fixStatus || undefined,
          issueCreatedAt: form.issueCreatedAt || undefined,
          lastModifiedAt: form.lastModifiedAt || undefined,
          severity: form.severity,
          priority: form.priority,
          assigneeName: form.assigneeName || undefined
        });
        setMessage('缺陷已创建');
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
    if (!window.confirm(`确定删除缺陷「${bug.title}」？`)) return;
    try {
      await deleteBug(bug.id);
      setMessage('缺陷已删除');
      void load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  }

  async function handleExport() {
    if (!selectedProjectId) {
      setError('请先选择项目');
      return;
    }
    setExporting(true);
    setError('');
    setMessage('');
    setLastImportResult(null);
    try {
      await exportBugs({
        projectId: selectedProjectId,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        priority: priorityFilter || undefined,
        search: search || undefined
      });
      setMessage('缺陷 Excel 已导出');
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File | null) {
    if (!file || !selectedProjectId) return;
    setImporting(true);
    setError('');
    setMessage('');
    setLastImportResult(null);
    try {
      const result = await importBugs(selectedProjectId, file);
      setLastImportResult(result);
      setMessage(`导入完成：成功 ${result.summary.success} 行，新建 ${result.summary.created} 行，更新 ${result.summary.updated} 行，失败 ${result.summary.failed} 行，跳过 ${result.summary.skipped} 行`);
      void load(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  function renderBugForm(submitLabel: string, cancel: () => void) {
    return (
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>问题描述 *</label>
            <input className="glass-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>指向人</label>
            <input
              className="glass-input"
              list="bug-target-person-options"
              value={form.targetPerson}
              onChange={e => setForm(f => ({ ...f, targetPerson: e.target.value }))}
            />
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
            <datalist id="bug-target-person-options">
              {formNameOptions.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>request_id</label>
            <input className="glass-input" value={form.requestId} onChange={e => setForm(f => ({ ...f, requestId: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>修复状态</label>
            <input className="glass-input" value={form.fixStatus} onChange={e => setForm(f => ({ ...f, fixStatus: e.target.value }))} placeholder="待修复 / 修复中 / 已修复" />
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
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>问题创建时间</label>
            <input className="glass-input" type="date" value={form.issueCreatedAt} onChange={e => setForm(f => ({ ...f, issueCreatedAt: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>最新修改日期</label>
            <input className="glass-input" type="date" value={form.lastModifiedAt} onChange={e => setForm(f => ({ ...f, lastModifiedAt: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>端侧上下文</label>
            <textarea className="glass-input" rows={3} value={form.clientContext} onChange={e => setForm(f => ({ ...f, clientContext: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>记忆上下文</label>
            <textarea className="glass-input" rows={3} value={form.memoryContext} onChange={e => setForm(f => ({ ...f, memoryContext: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>预期结果</label>
            <textarea className="glass-input" rows={3} value={form.expectedResult} onChange={e => setForm(f => ({ ...f, expectedResult: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>实际结果</label>
            <textarea className="glass-input" rows={3} value={form.actualResult} onChange={e => setForm(f => ({ ...f, actualResult: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>备注 / 复现步骤</label>
          <textarea className="glass-input" rows={2} value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn primary">{submitLabel}</button>
          <button type="button" className="btn" onClick={cancel}>取消</button>
        </div>
      </form>
    );
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
          placeholder="搜索问题描述 / request_id / 指向人..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
        {selectedProjectId && (
          <button className="btn" onClick={handleExport} disabled={exporting}>
            {exporting ? '导出中...' : '导出 Excel'}
          </button>
        )}
        {canWrite && selectedProjectId && (
          <>
            <button className="btn" onClick={() => importInputRef.current?.click()} disabled={importing}>
              {importing ? '导入中...' : '导入 Excel'}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={e => void handleImportFile(e.target.files?.[0] ?? null)}
            />
            <button className="btn primary" onClick={openCreate}>+ 新建缺陷</button>
          </>
        )}
      </div>

      {/* Create Form */}
      {showCreate && canWrite && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '0.75rem', borderColor: 'var(--color-primary)', border: '1px solid var(--color-border-strong)' }}>
          <h3 style={{ marginBottom: '1rem' }}>新建缺陷</h3>
          {renderBugForm(loading ? '提交中...' : '提交', () => setShowCreate(false))}
        </div>
      )}

      {/* Edit Panel */}
      {editingBug && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '0.75rem', borderColor: 'var(--color-primary)' }}>
          <h3 style={{ marginBottom: '1rem' }}>编辑缺陷 #{editingBug.id}</h3>
          {renderBugForm('保存', () => setEditingBug(null))}
        </div>
      )}

      {error && <div className="card warn" style={{ marginBottom: '0.75rem', padding: '0.75rem' }}>{error}</div>}
      {message && <div className="card" style={{ marginBottom: '0.75rem', padding: '0.75rem', borderColor: 'var(--color-primary)' }}>{message}</div>}
      {lastImportResult && lastImportResult.summary.failed > 0 && (
        <div className="card warn" style={{ marginBottom: '0.75rem', padding: '0.75rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>导入失败明细</div>
          <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
            {lastImportResult.results.filter(item => item.status === 'failed').map(item => (
              <div key={`${item.row}-${item.id ?? item.title ?? item.message}`}>
                第 {item.row} 行{item.id ? `，ID ${item.id}` : ''}{item.title ? `，「${item.title}」` : ''}：{item.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <AsyncStatePanel
          tone="loading"
          title="正在加载缺陷列表"
          description="正在同步当前项目下的缺陷状态、严重级别与优先级。"
        />
      ) : !selectedProjectId ? (
        <AsyncStatePanel
          tone="empty"
          title="请先选择项目"
          description="缺陷管理依赖当前项目上下文，请先在顶部选择目标项目。"
        />
      ) : items.length === 0 ? (
        <AsyncStatePanel
          tone="empty"
          title="暂无缺陷"
          description="当前项目还没有缺陷记录，可新建缺陷或切换筛选条件查看。"
        />
      ) : (
        <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>问题描述</th>
                <th>request_id</th>
                <th>修复状态</th>
                <th>指向人</th>
                <th>严重性</th>
                <th>优先级</th>
                <th>负责人</th>
                <th>创建人</th>
                <th>问题创建时间</th>
                <th>最新修改日期</th>
                <th>状态</th>
                {canWrite && <th>操作</th>}
              </tr>
            </thead>
            <tbody>
              {items.map(bug => (
                <tr key={bug.id} style={{ cursor: 'pointer' }} onClick={() => canWrite && openEdit(bug)}>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>#{bug.id}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{bug.title}</div>
                    {bug.actualResult && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.55, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        实际结果: {bug.actualResult}
                      </div>
                    )}
                    {bug.testCase && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>关联用例: {bug.testCase.title}</div>
                    )}
                  </td>
                  <td>{bug.requestId || '-'}</td>
                  <td>{bug.fixStatus || '-'}</td>
                  <td>{bug.targetPerson || '-'}</td>
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
                  <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>{bug.issueCreatedAt || new Date(bug.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>{bug.lastModifiedAt || new Date(bug.updatedAt).toLocaleDateString('zh-CN')}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {canWrite ? (
                      <div onClick={e => e.stopPropagation()}>
                        <ThemedSelect
                          value={bug.status}
                          onChange={e => { void handleStatusChange(bug, e.target.value as BugStatus); }}
                          style={{ color: STATUS_COLOR[bug.status], fontWeight: 600 }}
                        >
                          {STATUS_OPTIONS.filter(o => o.value).map(o => (
                            <option key={o.value!} value={o.value}>{o.label}</option>
                          ))}
                        </ThemedSelect>
                      </div>
                    ) : (
                      <span style={{ color: STATUS_COLOR[bug.status], fontWeight: 600 }}>{STATUS_LABELS[bug.status]}</span>
                    )}
                  </td>
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
