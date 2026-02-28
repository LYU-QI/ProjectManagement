import { useEffect, useMemo, useState } from 'react';
import { createProjectMembership, listProjectMemberships, removeProjectMembership } from '../api/projectMemberships';
import { createUser, resetUserPassword, updateUserRole } from '../api/users';
import type { ProjectItem, ProjectMembershipItem, UserItem } from '../types';

type Props = {
  users: UserItem[];
  projects: ProjectItem[];
  canManage: boolean;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
  onReloadUsers: () => Promise<void>;
};

const ROLE_OPTIONS: UserItem['role'][] = ['super_admin', 'project_director', 'project_manager', 'pm', 'lead', 'viewer'];

export default function ProjectAccessView({ users, projects, canManage, onError, onMessage, onReloadUsers }: Props) {
  const [rows, setRows] = useState<ProjectMembershipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    name: '',
    password: '',
    role: 'project_manager' as UserItem['role']
  });
  const [form, setForm] = useState({
    userId: '',
    projectId: '',
    role: 'member' as 'director' | 'manager' | 'member' | 'viewer'
  });

  const projectOptions = useMemo(() => projects.map((p) => ({ value: String(p.id), label: `${p.name} (#${p.id})` })), [projects]);
  const userOptions = useMemo(() => users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.username})` })), [users]);

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await listProjectMemberships();
      setRows(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : '加载项目授权失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const onSubmit = async () => {
    if (!form.userId || !form.projectId) {
      onError('请选择用户和项目');
      return;
    }
    try {
      await createProjectMembership({
        userId: Number(form.userId),
        projectId: Number(form.projectId),
        role: form.role
      });
      onMessage('项目授权已保存');
      await loadRows();
    } catch (err) {
      onError(err instanceof Error ? err.message : '保存项目授权失败');
    }
  };

  const onRemove = async (id: number) => {
    if (!confirm('确认删除该授权吗？')) return;
    try {
      await removeProjectMembership(id);
      onMessage('授权已删除');
      await loadRows();
    } catch (err) {
      onError(err instanceof Error ? err.message : '删除授权失败');
    }
  };

  const onCreateUser = async () => {
    if (!canManage) return;
    if (!newUserForm.username.trim() || !newUserForm.name.trim() || !newUserForm.password.trim()) {
      onError('请填写账号、姓名和密码');
      return;
    }
    if (newUserForm.password.trim().length < 6) {
      onError('密码至少 6 位');
      return;
    }
    try {
      await createUser({
        username: newUserForm.username.trim(),
        name: newUserForm.name.trim(),
        password: newUserForm.password.trim(),
        role: newUserForm.role
      });
      onMessage(`用户 ${newUserForm.username.trim()} 已创建`);
      setNewUserForm({
        username: '',
        name: '',
        password: '',
        role: 'project_manager'
      });
      await onReloadUsers();
    } catch (err) {
      onError(err instanceof Error ? err.message : '创建用户失败');
    }
  };

  const onResetPassword = async (user: UserItem) => {
    if (!canManage) return;
    const next = window.prompt(`为 ${user.username} 设置新密码（至少 6 位）`, '123456');
    if (!next) return;
    if (next.trim().length < 6) {
      onError('密码至少 6 位');
      return;
    }
    try {
      await resetUserPassword(user.id, next.trim());
      onMessage(`用户 ${user.username} 密码已重置`);
    } catch (err) {
      onError(err instanceof Error ? err.message : '重置密码失败');
    }
  };

  const onUpdateRole = async (user: UserItem, role: UserItem['role']) => {
    if (!canManage) return;
    if (role === user.role) return;
    try {
      setUpdatingUserId(user.id);
      await updateUserRole(user.id, role);
      onMessage(`用户 ${user.username} 角色已更新为 ${role}`);
      await onReloadUsers();
    } catch (err) {
      onError(err instanceof Error ? err.message : '更新用户角色失败');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card">
        <h3>管理后台 · 用户角色</h3>
        <p style={{ color: 'var(--text-muted)', margin: '6px 0 12px' }}>
          仅超级管理员/项目总监可管理用户。项目总监仅可分配 project_manager / pm / viewer。
        </p>
        <div className="form" style={{ gridTemplateColumns: '180px 180px 180px 200px auto', marginBottom: 12 }}>
          <input
            value={newUserForm.username}
            placeholder="账号（username）"
            onChange={(e) => setNewUserForm((prev) => ({ ...prev, username: e.target.value }))}
          />
          <input
            value={newUserForm.name}
            placeholder="姓名"
            onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            type="password"
            value={newUserForm.password}
            placeholder="初始密码（>=6位）"
            onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
          />
          <select
            value={newUserForm.role}
            onChange={(e) => setNewUserForm((prev) => ({ ...prev, role: e.target.value as UserItem['role'] }))}
          >
            {ROLE_OPTIONS.map((item) => (
              <option key={`new-role-${item}`} value={item}>{item}</option>
            ))}
          </select>
          <button className="btn btn-primary" type="button" disabled={!canManage} onClick={() => void onCreateUser()}>
            新增用户
          </button>
        </div>
        <table className="table table-wrap" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>姓名</th>
              <th>账号</th>
              <th>当前角色</th>
              <th>目标角色</th>
              <th>密码</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={`user-${u.id}`}>
                <td>{u.id}</td>
                <td>{u.name}</td>
                <td>{u.username}</td>
                <td>{u.role}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={!canManage || updatingUserId === u.id}
                    onChange={(e) => void onUpdateRole(u, e.target.value as UserItem['role'])}
                  >
                    {ROLE_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    className="btn btn-small"
                    type="button"
                    disabled={!canManage || updatingUserId === u.id}
                    onClick={() => void onResetPassword(u)}
                  >
                    重置密码
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--text-muted)' }}>暂无用户数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>管理后台 · 项目成员授权</h3>
        <p style={{ color: 'var(--text-muted)', margin: '6px 0 12px' }}>
          用于配置“谁能访问哪个项目”。同一用户可绑定多个项目。
        </p>
        <div className="form" style={{ gridTemplateColumns: '1fr 1fr 160px auto' }}>
          <select value={form.userId} onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}>
            <option value="">选择用户</option>
            {userOptions.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
          <select value={form.projectId} onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))}>
            <option value="">选择项目</option>
            {projectOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as 'director' | 'manager' | 'member' | 'viewer' }))}>
            <option value="director">director</option>
            <option value="manager">manager</option>
            <option value="member">member</option>
            <option value="viewer">viewer</option>
          </select>
          <button className="btn" type="button" disabled={!canManage} onClick={() => void onSubmit()}>
            新增/更新授权
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>授权列表</h3>
          <button className="btn btn-small" type="button" onClick={() => void loadRows()} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
        <table className="table table-wrap">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户</th>
              <th>项目</th>
              <th>授权角色</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.user.name} (#{row.user.id})</td>
                <td>{row.project.name} (#{row.project.id})</td>
                <td>{row.role}</td>
                <td>{new Date(row.updatedAt).toLocaleString()}</td>
                <td>
                  <button className="btn btn-small" disabled={!canManage} onClick={() => void onRemove(row.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--text-muted)' }}>暂无授权记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
