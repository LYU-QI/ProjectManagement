import type { AuditLogItem } from '../types';

type Props = {
  auditLogs: AuditLogItem[];
};

export default function AuditView({ auditLogs }: Props) {
  return (
    <div className="card">
      <h3>审计日志</h3>
      <table className="table">
        <thead><tr><th>时间</th><th>用户</th><th>角色</th><th>方法</th><th>路径</th></tr></thead>
        <tbody>
          {auditLogs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.userName || '-'}</td>
              <td>{log.userRole || '-'}</td>
              <td>{log.method}</td>
              <td>{log.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
