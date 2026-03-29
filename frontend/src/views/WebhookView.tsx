import { useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/client';

const AVAILABLE_EVENTS = [
  'requirement.created',
  'requirement.updated',
  'requirement.status_changed',
  'workitem.created',
  'workitem.updated',
  'workitem.status_changed',
  'bug.created',
  'bug.updated',
  'project.created',
  'project.updated'
];

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface DeliveryItem {
  id: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  response: string | null;
  error: string | null;
  attemptedAt: string;
}

export default function WebhookView() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUrl, setCreateUrl] = useState('');
  const [createSecret, setCreateSecret] = useState('');
  const [createEvents, setCreateEvents] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [deliveriesTotal, setDeliveriesTotal] = useState(0);
  const [deliveryPage, setDeliveryPage] = useState(1);

  function loadWebhooks() {
    setLoading(true);
    setError('');
    apiGet<WebhookItem[]>('/webhooks')
      .then(setWebhooks)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function toggleEvent(evt: string) {
    setCreateEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
    );
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim() || !createUrl.trim() || createEvents.length === 0) {
      setError('请填写名称、URL并选择至少一个事件');
      return;
    }
    apiPost<{ id: string; secret: string }>('/webhooks', {
      name: createName,
      url: createUrl,
      secret: createSecret || undefined,
      events: createEvents
    })
      .then((res) => {
        setMessage(`Webhook 已创建${res.secret ? `，密钥：${res.secret}（请妥善保存，仅显示一次）` : ''}`);
        setShowCreate(false);
        setCreateName('');
        setCreateUrl('');
        setCreateSecret('');
        setCreateEvents([]);
        loadWebhooks();
      })
      .catch((e: Error) => setError(e.message));
  }

  function toggleWebhook(webhook: WebhookItem) {
    apiPatch(`/webhooks/${webhook.id}`, { enabled: !webhook.enabled })
      .then(() => loadWebhooks())
      .catch((e: Error) => setError(e.message));
  }

  function deleteWebhook(webhook: WebhookItem) {
    if (!window.confirm(`确定删除 Webhook「${webhook.name}」？`)) return;
    apiDelete(`/webhooks/${webhook.id}`)
      .then(() => {
        setMessage('Webhook 已删除');
        loadWebhooks();
      })
      .catch((e: Error) => setError(e.message));
  }

  function testWebhook(webhook: WebhookItem) {
    apiPost(`/webhooks/${webhook.id}/test`, {})
      .then((res: any) => {
        if (res.success) {
          setMessage(`测试消息发送成功 (HTTP ${res.statusCode})`);
        } else {
          setError(`发送失败：${res.error || `HTTP ${res.statusCode}`}`);
        }
        loadWebhooks();
      })
      .catch((e: Error) => setError(e.message));
  }

  function loadDeliveries(webhookId: string, page = 1) {
    apiGet<{ items: DeliveryItem[]; total: number }>(`/webhooks/${webhookId}/deliveries?page=${page}&limit=20`)
      .then((res) => {
        setDeliveries(res.items);
        setDeliveriesTotal(res.total);
        setDeliveryPage(page);
      })
      .catch((e: Error) => setError(e.message));
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadDeliveries(id, 1);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <button className="btn" onClick={loadWebhooks}>刷新</button>
          <button className="btn primary" style={{ marginLeft: '0.5rem' }} onClick={() => setShowCreate(true)}>新建 Webhook</button>
        </div>
      </div>

      {error && <p className="warn">{error}</p>}
      {message && <p style={{ color: 'var(--color-success, green)' }}>{message}</p>}

      {showCreate && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>新建 Webhook</h3>
          <form onSubmit={submitCreate}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>名称</label>
              <input className="glass-input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="例如：Zapier Integration" required />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>Endpoint URL</label>
              <input className="glass-input" value={createUrl} onChange={(e) => setCreateUrl(e.target.value)} placeholder="https://..." type="url" required />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>密钥 (可选，用于 HMAC 签名)</label>
              <input className="glass-input" value={createSecret} onChange={(e) => setCreateSecret(e.target.value)} placeholder="留空则自动生成" />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.2rem' }}>订阅事件</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {AVAILABLE_EVENTS.map((evt) => (
                  <label key={evt} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={createEvents.includes(evt)} onChange={() => toggleEvent(evt)} />
                    {evt}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn primary">创建</button>
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      {loading && <p>加载中...</p>}

      {!loading && webhooks.length === 0 && (
        <p className="muted">暂无 Webhook，请创建一个。</p>
      )}

      {!loading && webhooks.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>名称</th>
              <th>URL</th>
              <th>事件</th>
              <th>状态</th>
              <th>最近触发</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {webhooks.map((wh) => (
              <>
                <tr key={wh.id}>
                  <td>{wh.name}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wh.url}</td>
                  <td style={{ fontSize: '0.8rem', maxWidth: 200 }}>{wh.events.join(', ')}</td>
                  <td>
                    <button
                      className={`btn ${wh.enabled ? 'btn-primary' : ''}`}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => toggleWebhook(wh)}
                    >
                      {wh.enabled ? '启用' : '禁用'}
                    </button>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {wh.lastTriggeredAt ? new Date(wh.lastTriggeredAt).toLocaleString() : '从未'}
                  </td>
                  <td>
                    <button className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => testWebhook(wh)}>测试</button>
                    <button className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.25rem' }} onClick={() => toggleExpand(wh.id)}>
                      {expandedId === wh.id ? '收起' : '日志'}
                    </button>
                    <button className="btn warn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.25rem' }} onClick={() => deleteWebhook(wh)}>删除</button>
                  </td>
                </tr>
                {expandedId === wh.id && (
                  <tr key={`${wh.id}-deliveries`}>
                    <td colSpan={6}>
                      <div style={{ padding: '0.5rem', background: 'var(--color-bg-secondary)', borderRadius: '0.5rem', margin: '0.25rem 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <strong>投递日志 (共 {deliveriesTotal} 条)</strong>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} disabled={deliveryPage <= 1} onClick={() => loadDeliveries(wh.id, deliveryPage - 1)}>上一页</button>
                            <button className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} disabled={deliveryPage * 20 >= deliveriesTotal} onClick={() => loadDeliveries(wh.id, deliveryPage + 1)}>下一页</button>
                          </div>
                        </div>
                        {deliveries.length === 0 && <p className="muted">暂无投递记录</p>}
                        {deliveries.map((d) => (
                          <div key={d.id} style={{ display: 'flex', gap: '1rem', padding: '0.3rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
                            <span style={{ color: d.success ? 'var(--color-success, green)' : 'var(--color-error, red)', minWidth: 60 }}>
                              {d.success ? '成功' : '失败'}
                            </span>
                            <span style={{ minWidth: 80 }}>{d.event}</span>
                            <span style={{ minWidth: 60 }}>{d.statusCode || '-'}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.error || d.response || '-'}</span>
                            <span style={{ minWidth: 140 }}>{new Date(d.attemptedAt).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
