import type { NotificationItem } from '../types';

type Props = {
  notifications: NotificationItem[];
  onMarkRead: (id: number) => void;
};

export default function NotificationsView({ notifications, onMarkRead }: Props) {
  return (
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
  );
}
