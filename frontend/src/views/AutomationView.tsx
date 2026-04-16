import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/client';
import useEventStream from '../hooks/useEventStream';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import AsyncStatePanel from '../components/AsyncStatePanel';
import TableToolbar from '../components/TableToolbar';

const TRIGGERS = [
  { value: 'requirement_created', label: '需求创建时' },
  { value: 'requirement_status_changed', label: '需求状态变更时' },
  { value: 'workitem_created', label: '任务创建时' },
  { value: 'workitem_status_changed', label: '任务状态变更时' },
  { value: 'bug_created', label: '缺陷创建时' },
  { value: 'bug_severity_critical', label: '严重缺陷出现时' },
  { value: 'cost_over_budget', label: '成本超预算时' },
  { value: 'milestone_due_soon', label: '里程碑临近时' }
] as const;

type TriggerValue = typeof TRIGGERS[number]['value'];
const TRIGGER_LABEL_MAP = new Map<string, string>(TRIGGERS.map((item) => [item.value, item.label]));

interface AutomationItem {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger: string;
  conditions: unknown;
  actions: unknown;
  createdAt: string;
}

interface AutomationLogItem {
  id: string;
  trigger: string;
  success: boolean;
  error?: string | null;
  executionAt: string;
}

export default function AutomationView() {
  const recoveryContext = useWorkspaceStore((state) => state.recoveryContext);
  const clearRecoveryContext = useWorkspaceStore((state) => state.clearRecoveryContext);
  const [pageRecoveryContext, setPageRecoveryContext] = useState<typeof recoveryContext>(null);
  const recoveryHandledRef = useRef<string | null>(null);
  const [items, setItems] = useState<AutomationItem[]>([]);
  const [logsByRuleId, setLogsByRuleId] = useState<Record<string, AutomationLogItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createTrigger, setCreateTrigger] = useState<TriggerValue>(TRIGGERS[0].value);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [triggerFilter, setTriggerFilter] = useState<'all' | TriggerValue>('all');
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'success' | 'failed'>('all');

  function getTriggerLabel(trigger: string) {
    return TRIGGER_LABEL_MAP.get(trigger) ?? trigger;
  }

  function loadItems() {
    setLoading(true);
    setError('');
    apiGet<AutomationItem[]>('/automations')
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadItems();
  }, []);

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) {
      setError('请填写名称');
      return;
    }
    apiPost<AutomationItem>('/automations', {
      name: createName,
      description: createDesc || undefined,
      trigger: createTrigger,
      conditions: {},
      actions: {},
      enabled: true
    })
      .then(() => {
        setMessage('自动化规则已创建');
        setShowCreate(false);
        setCreateName('');
        setCreateDesc('');
        loadItems();
      })
      .catch((e: Error) => setError(e.message));
  }

  function toggleItem(item: AutomationItem) {
    apiPatch(`/automations/${item.id}`, { enabled: !item.enabled })
      .then(() => loadItems())
      .catch((e: Error) => setError(e.message));
  }

  function deleteItem(item: AutomationItem) {
    if (!window.confirm(`确定删除「${item.name}」？`)) return;
    apiDelete(`/automations/${item.id}`)
      .then(() => {
        setMessage('已删除');
        loadItems();
      })
      .catch((e: Error) => setError(e.message));
  }

  function runItem(item: AutomationItem) {
    apiPost(`/automations/${item.id}/run`, {})
      .then((res: any) => {
        setMessage(`执行完成: ${res.success ? '成功' : '失败'}`);
        if (expandedId === item.id) loadLogs(item.id);
      })
      .catch((e: Error) => setError(e.message));
  }

  async function loadLogs(id: string) {
    try {
      const logs = await apiGet<AutomationLogItem[]>(`/automations/${id}/logs`);
      setLogsByRuleId((prev) => ({ ...prev, [id]: logs }));
      return logs;
    } catch (e: any) {
      setError(e.message || '加载执行日志失败');
      return [];
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadLogs(id);
    }
  }

  useEventStream({
    enabled: true,
    eventTypes: ['automation.rule.changed', 'automation.rule.executed'],
    onEvent: (event) => {
      if (event.type === 'automation.rule.changed') {
        loadItems();
        return;
      }
      if (event.type === 'automation.rule.executed') {
        loadItems();
        const ruleId = String(event.payload?.ruleId ?? '');
        if (ruleId && expandedId === ruleId) {
          loadLogs(ruleId);
        }
      }
    }
  });

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (triggerFilter !== 'all' && item.trigger !== triggerFilter) return false;
      if (!query) return true;
      const haystack = [item.name, item.description || '', getTriggerLabel(item.trigger)].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [items, searchQuery, triggerFilter]);

  function getVisibleLogs(ruleId: string) {
    const logs = logsByRuleId[ruleId] || [];
    if (logStatusFilter === 'all') return logs;
    return logs.filter((log) => (logStatusFilter === 'success' ? log.success : !log.success));
  }

  useEffect(() => {
    if (!(recoveryContext?.from === 'task-center' && recoveryContext.source === 'automation')) return;
    if (items.length === 0) return;
    const recoveryKey = [
      recoveryContext.errorCode || '',
      recoveryContext.projectName || '',
      items.length
    ].join(':');
    if (recoveryHandledRef.current === recoveryKey) return;
    recoveryHandledRef.current = recoveryKey;
    setPageRecoveryContext(recoveryContext);
    setLogStatusFilter('failed');
    void (async () => {
      const entries = await Promise.all(items.map(async (item) => ({
        id: item.id,
        logs: await loadLogs(item.id)
      })));
      const failedTarget = entries.find((entry) => entry.logs.some((log) => !log.success));
      setExpandedId(failedTarget?.id ?? items[0]?.id ?? null);
    })();
    clearRecoveryContext();
  }, [items, recoveryContext, clearRecoveryContext]);

  return (
    <div>
      {pageRecoveryContext?.from === 'task-center' && pageRecoveryContext.source === 'automation' && (
        <div className="task-center-recovery-banner">
          <div>
            <strong>来自任务中心的恢复上下文</strong>
            <div className="muted">
              当前建议优先检查自动化规则执行结果
              {pageRecoveryContext.errorCode ? `（${pageRecoveryContext.errorCode}）` : ''}
              {pageRecoveryContext.projectName ? `，项目：${pageRecoveryContext.projectName}` : ''}。
            </div>
          </div>
          <button type="button" className="btn" onClick={() => setPageRecoveryContext(null)}>
            关闭提示
          </button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <button className="btn" onClick={loadItems}>刷新</button>
          <button className="btn primary" style={{ marginLeft: '0.5rem' }} onClick={() => { setShowCreate(true); loadItems(); }}>新建规则</button>
        </div>
      </div>

      <TableToolbar>
        <div className="table-toolbar-section table-toolbar-section--grow">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索规则名称/描述"
          />
          <select value={triggerFilter} onChange={(e) => setTriggerFilter(e.target.value as 'all' | TriggerValue)}>
            <option value="all">全部触发器</option>
            {TRIGGERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select value={logStatusFilter} onChange={(e) => setLogStatusFilter(e.target.value as 'all' | 'success' | 'failed')}>
            <option value="all">全部日志</option>
            <option value="failed">失败日志</option>
            <option value="success">成功日志</option>
          </select>
        </div>
        <div className="table-toolbar-section table-toolbar-section--actions">
          <span className="table-toolbar-meta">当前显示 {filteredItems.length} 条规则</span>
        </div>
      </TableToolbar>

      {error && <p className="warn">{error}</p>}
      {message && <p style={{ color: 'var(--color-success, green)' }}>{message}</p>}

      {showCreate && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>新建自动化规则</h3>
          <form onSubmit={submitCreate}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>名称</label>
              <input className="glass-input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="例如：需求完成通知" required />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>描述</label>
              <input className="glass-input" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="可选" />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>触发器</label>
              <select className="glass-input" value={createTrigger} onChange={(e) => setCreateTrigger(e.target.value as TriggerValue)}>
                {TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn primary">创建</button>
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <AsyncStatePanel
          tone="loading"
          title="正在加载自动化规则"
          description="正在同步规则列表和最近执行状态。"
        />
      )}

      {!loading && filteredItems.length === 0 && (
        <AsyncStatePanel
          tone={error ? 'error' : 'empty'}
          title={error ? '自动化规则加载异常' : '暂无自动化规则'}
          description={error
            ? '请检查接口返回、筛选条件或网络状态后重试。'
            : '可以直接新建第一条规则，或放宽当前筛选条件。'}
          action={(
            <button className="btn" type="button" onClick={loadItems}>
              重新刷新
            </button>
          )}
        />
      )}

      {!loading && filteredItems.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>名称</th>
              <th>触发器</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <Fragment key={item.id}>
                <tr key={item.id}>
                  <td>
                    <span style={{ cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline' }} onClick={() => toggleExpand(item.id)}>
                      {item.name}
                    </span>
                    {item.description && <div className="muted" style={{ fontSize: '0.75rem' }}>{item.description}</div>}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{getTriggerLabel(item.trigger)}</td>
                  <td>
                    <button className={`btn ${item.enabled ? 'btn-primary' : ''}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => toggleItem(item)}>
                      {item.enabled ? '启用' : '禁用'}
                    </button>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>
                    <button className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => runItem(item)}>运行</button>
                    <button className="btn warn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.25rem' }} onClick={() => deleteItem(item)}>删除</button>
                  </td>
                </tr>
                {expandedId === item.id && (
                  <tr key={`${item.id}:logs`}>
                    <td colSpan={5}>
                      {getVisibleLogs(item.id).length === 0 ? (
                        <div className="muted" style={{ fontSize: '0.8rem' }}>暂无执行日志。</div>
                      ) : (
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          {getVisibleLogs(item.id).map((log) => (
                            <div key={log.id} style={{ fontSize: '0.8rem' }}>
                              <strong>{log.success ? '成功' : '失败'}</strong>
                              {` · ${new Date(log.executionAt).toLocaleString()} · ${getTriggerLabel(log.trigger)}`}
                              {log.error ? ` · ${log.error}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
