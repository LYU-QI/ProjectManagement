import { useMemo, useState } from 'react';
import type { NotificationItem } from '../types';

type Props = {
  notifications: NotificationItem[];
  onMarkRead: (id: number) => void;
  settings: { riskThreshold: number; budgetVarianceThreshold: number; enableSystemAlerts: boolean };
  onUpdateSettings: (settings: { riskThreshold: number; budgetVarianceThreshold: number; enableSystemAlerts: boolean }) => void;
};

export default function NotificationsView({ notifications, onMarkRead, settings, onUpdateSettings }: Props) {
  const [filterLevel, setFilterLevel] = useState('');
  const [filterRead, setFilterRead] = useState('all');
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filterLevel && n.level !== filterLevel) return false;
      if (filterRead === 'read' && !n.readAt) return false;
      if (filterRead === 'unread' && n.readAt) return false;
      if (keyword) {
        const text = `${n.title} ${n.message}`.toLowerCase();
        if (!text.includes(keyword.toLowerCase())) return false;
      }
      return true;
    });
  }, [notifications, filterLevel, filterRead, keyword]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>通知规则配置</h3>
        <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: 12 }}>风险等级阈值</label>
            <input
              type="number"
              min={1}
              max={5}
              value={settings.riskThreshold}
              onChange={(e) => onUpdateSettings({ ...settings, riskThreshold: Number(e.target.value) })}
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: 12 }}>预算偏差阈值(%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.budgetVarianceThreshold}
              onChange={(e) => onUpdateSettings({ ...settings, budgetVarianceThreshold: Number(e.target.value) })}
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: 12 }}>系统预警开关</label>
            <select
              value={settings.enableSystemAlerts ? 'on' : 'off'}
              onChange={(e) => onUpdateSettings({ ...settings, enableSystemAlerts: e.target.value === 'on' })}
            >
              <option value="on">开启</option>
              <option value="off">关闭</option>
            </select>
          </div>
        </div>
      </div>
      <div className="card">
        <h3>通知中心</h3>
        <div
          className="filter-panel"
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            border: '1px solid var(--border-tech)',
            background: 'rgba(3, 10, 24, 0.65)',
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>筛选</div>
          <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
              <option value="">全部级别</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
            <select value={filterRead} onChange={(e) => setFilterRead(e.target.value)}>
              <option value="all">全部状态</option>
              <option value="unread">未读</option>
              <option value="read">已读</option>
            </select>
            <input placeholder="关键词" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
        </div>
        <table className="table">
          <thead><tr><th>级别</th><th>标题</th><th>内容</th><th>时间</th><th>状态</th></tr></thead>
          <tbody>
            {filtered.map((n) => (
              <tr key={n.id}>
                <td>{n.level}</td>
                <td>{n.title}</td>
                <td>{n.message}</td>
                <td>{new Date(n.createdAt).toLocaleString()}</td>
                <td>
                  {n.readAt ? '已读' : <button className="btn" type="button" onClick={() => onMarkRead(n.id)}>标记已读</button>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>暂无通知</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
