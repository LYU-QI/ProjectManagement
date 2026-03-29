import { useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/client';

interface DepartmentItem {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number | null;
  memberCount?: number;
  children?: DepartmentItem[];
}

export default function DepartmentsView() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createParentId, setCreateParentId] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function load() {
    setLoading(true);
    setError('');
    apiGet<DepartmentItem[]>('/departments')
      .then(setDepartments)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) {
      setError('请填写名称');
      return;
    }
    apiPost<DepartmentItem>('/departments', {
      name: createName,
      parentId: createParentId || undefined
    })
      .then(() => {
        setMessage('部门已创建');
        setShowCreate(false);
        setCreateName('');
        setCreateParentId('');
        load();
      })
      .catch((e: Error) => setError(e.message));
  }

  function deleteDept(dept: DepartmentItem) {
    if (!window.confirm(`确定删除「${dept.name}」？`)) return;
    apiDelete(`/departments/${dept.id}`)
      .then(() => {
        setMessage('已删除');
        load();
      })
      .catch((e: Error) => setError(e.message));
  }

  function syncFromFeishu() {
    if (!window.confirm('确定从飞书同步部门？')) return;
    apiPost('/departments/sync', { departments: [] })
      .then(() => setMessage('同步已发起'))
      .catch((e: Error) => setError(`同步失败：${e.message}`));
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderDept(dept: DepartmentItem, depth = 0) {
    const hasChildren = dept.children && dept.children.length > 0;
    const isExpanded = expandedIds.has(dept.id);
    return (
      <tr key={dept.id}>
        <td>
          <span style={{ paddingLeft: depth * 20 }} />
          {hasChildren && (
            <button className="btn" style={{ padding: '0 0.3rem', fontSize: '0.7rem', marginRight: '0.25rem' }} onClick={() => toggleExpand(dept.id)}>
              {isExpanded ? '−' : '+'}
            </button>
          )}
          {dept.name}
          {dept.memberCount !== undefined && <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>({dept.memberCount}人)</span>}
        </td>
        <td style={{ fontSize: '0.85rem' }}>{dept.description || '—'}</td>
        <td>
          <button className="btn warn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => deleteDept(dept)}>删除</button>
        </td>
      </tr>
    );
  }

  function renderTree(depts: DepartmentItem[], depth = 0): React.ReactNode[] {
    return depts.flatMap((dept) => [
      renderDept(dept, depth),
      ...(expandedIds.has(dept.id) && dept.children ? renderTree(dept.children, depth + 1) : [])
    ]);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <button className="btn" onClick={load}>刷新</button>
          <button className="btn primary" style={{ marginLeft: '0.5rem' }} onClick={() => setShowCreate(true)}>新建部门</button>
        </div>
        <button className="btn" onClick={syncFromFeishu}>从飞书同步</button>
      </div>

      {error && <p className="warn">{error}</p>}
      {message && <p style={{ color: 'var(--color-success, green)' }}>{message}</p>}

      {showCreate && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>新建部门</h3>
          <form onSubmit={submitCreate}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>名称</label>
              <input className="glass-input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="例如：研发部" required />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>上级部门</label>
              <select className="glass-input" value={createParentId} onChange={(e) => setCreateParentId(e.target.value)}>
                <option value="">无</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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

      {!loading && departments.length === 0 && (
        <p className="muted">暂无部门。</p>
      )}

      {!loading && departments.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>名称</th>
              <th>描述</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {renderTree(departments)}
          </tbody>
        </table>
      )}
    </div>
  );
}
