import { useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/client';

const TRIGGERS = [
  'requirement_created',
  'requirement_status_changed',
  'workitem_created',
  'workitem_status_changed',
  'bug_created',
  'bug_severity_critical',
  'cost_over_budget',
  'milestone_due_soon'
];

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

export default function AutomationView() {
  const [items, setItems] = useState<AutomationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createTrigger, setCreateTrigger] = useState(TRIGGERS[0]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function loadItems() {
    setLoading(true);
    setError('');
    apiGet<AutomationItem[]>('/automations')
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

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

  function loadLogs(id: string) {
    apiGet(`/automations/${id}/logs`).catch((e: Error) => setError(e.message));
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadLogs(id);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <button className="btn" onClick={loadItems}>刷新</button>
          <button className="btn primary" style={{ marginLeft: '0.5rem' }} onClick={() => { setShowCreate(true); loadItems(); }}>新建规则</button>
        </div>
      </div>

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
              <select className="glass-input" value={createTrigger} onChange={(e) => setCreateTrigger(e.target.value)}>
                {TRIGGERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
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

      {loading && <p>加载中...</p>}

      {!loading && items.length === 0 && (
        <p className="muted">暂无自动化规则。</p>
      )}

      {!loading && items.length > 0 && (
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
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <span style={{ cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline' }} onClick={() => toggleExpand(item.id)}>
                    {item.name}
                  </span>
                  {item.description && <div className="muted" style={{ fontSize: '0.75rem' }}>{item.description}</div>}
                </td>
                <td style={{ fontSize: '0.8rem' }}>{item.trigger}</td>
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
