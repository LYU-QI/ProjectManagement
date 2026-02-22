import type { NotificationItem } from '../types';

type Props = {
  notifications: NotificationItem[];
  onMarkRead: (id: number) => void;
  settings: { riskThreshold: number; budgetVarianceThreshold: number; enableSystemAlerts: boolean };
  onUpdateSettings: (settings: { riskThreshold: number; budgetVarianceThreshold: number; enableSystemAlerts: boolean }) => void;
};

export default function NotificationsView({ notifications, onMarkRead, settings, onUpdateSettings }: Props) {
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
                  {n.readAt ? '已读' : <button className="btn" type="button" onClick={() => onMarkRead(n.id)}>标记已读</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
