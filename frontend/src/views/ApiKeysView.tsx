import { useState } from 'react';
import { apiDelete, apiGet, apiPost } from '../api/client';
import AsyncStatePanel from '../components/AsyncStatePanel';

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  key?: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function ApiKeysView() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPermissions, setCreatePermissions] = useState<string[]>(['read']);
  const [newKey, setNewKey] = useState<string | null>(null);

  const ALL_PERMISSIONS = ['read', 'write', 'admin'];

  function loadKeys() {
    setLoading(true);
    setError('');
    apiGet<ApiKeyItem[]>('/api-keys')
      .then(setKeys)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function togglePermission(perm: string) {
    setCreatePermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) {
      setError('请填写名称');
      return;
    }
    if (createPermissions.length === 0) {
      setError('请至少选择一个权限');
      return;
    }
    apiPost<ApiKeyItem>('/api-keys', {
      name: createName,
      permissions: createPermissions
    })
      .then((res) => {
        setNewKey(res.key || null);
        setMessage('API Key 已生成，请妥善保存，仅显示一次！');
        setShowCreate(false);
        setCreateName('');
        setCreatePermissions(['read']);
        loadKeys();
      })
      .catch((e: Error) => setError(e.message));
  }

  function revokeKey(key: ApiKeyItem) {
    if (!window.confirm(`确定撤销 API Key「${key.name}」？此操作不可恢复。`)) return;
    apiDelete(`/api-keys/${key.id}`)
      .then(() => {
        setMessage('API Key 已撤销');
        loadKeys();
      })
      .catch((e: Error) => setError(e.message));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <button className="btn" onClick={loadKeys}>刷新</button>
          <button className="btn primary" style={{ marginLeft: '0.5rem' }} onClick={() => { setShowCreate(true); setNewKey(null); setMessage(''); }}>生成新 Key</button>
        </div>
      </div>

      {error && <p className="warn">{error}</p>}
      {message && <p style={{ color: 'var(--color-success, green)' }}>{message}</p>}

      {newKey && (
        <div className="card" style={{ marginBottom: '1rem', background: 'var(--color-warning-bg, #fff3cd)', border: '1px solid var(--color-warning, #856404)' }}>
          <h3 style={{ color: 'var(--color-warning, #856404)' }}>新 API Key（仅显示一次，请立即复制）</h3>
          <pre style={{ background: '#fff', padding: '0.5rem', borderRadius: '0.3rem', overflow: 'auto', fontSize: '0.85rem', wordBreak: 'break-all' }}>{newKey}</pre>
          <button className="btn" style={{ marginTop: '0.5rem' }} onClick={() => setNewKey(null)}>关闭</button>
        </div>
      )}

      {showCreate && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>生成 API Key</h3>
          <form onSubmit={submitCreate}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>名称</label>
              <input className="glass-input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="例如：Zapier Integration" required />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>权限</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {ALL_PERMISSIONS.map((perm) => (
                  <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={createPermissions.includes(perm)} onChange={() => togglePermission(perm)} />
                    {perm}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn primary">生成</button>
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <AsyncStatePanel
          tone="loading"
          title="正在加载 API Keys"
          description="正在同步当前可用的访问密钥和使用情况。"
        />
      )}

      {!loading && keys.length === 0 && (
        <AsyncStatePanel
          tone="empty"
          title="暂无 API Keys"
          description="当前还没有可用的 API Key。生成后可用于外部系统集成。"
        />
      )}

      {!loading && keys.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>名称</th>
              <th>Key 前缀</th>
              <th>权限</th>
              <th>最近使用</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td>{key.name}</td>
                <td><code>{key.keyPrefix}***</code></td>
                <td>{key.permissions.join(', ')}</td>
                <td style={{ fontSize: '0.85rem' }}>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : '从未'}</td>
                <td style={{ fontSize: '0.85rem' }}>{new Date(key.createdAt).toLocaleString()}</td>
                <td>
                  <button className="btn warn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => revokeKey(key)}>撤销</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>API Key 使用说明</h3>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
          在请求头中添加 <code>X-Api-Key: pk_your_key_here</code> 即可使用 API Key 认证。
          API Key 可以代替 JWT Token 用于外部系统集成。
        </p>
      </div>
    </div>
  );
}
