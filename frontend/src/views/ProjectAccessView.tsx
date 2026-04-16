import { useEffect, useMemo, useState } from 'react';
import { createProjectMembership, listProjectMemberships, removeProjectMembership } from '../api/projectMemberships';
import { createUser, deleteUser, resetUserPassword, updateUserRole } from '../api/users';
import type { ProjectItem, ProjectMembershipItem, UserItem } from '../types';
import ThemedSelect from '../components/ui/ThemedSelect';
import AsyncStatePanel from '../components/AsyncStatePanel';

type Props = {
  users: UserItem[];
  projects: ProjectItem[];
  canManageUserAccounts: boolean;
  canDeleteUserAccounts: boolean;
  canManageProjectMembership: boolean;
  currentUserId?: number;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
  onReloadUsers: () => Promise<void>;
};

const USER_ROLE_OPTIONS: UserItem['role'][] = ['super_admin', 'project_manager', 'pm', 'member', 'viewer'];

const USER_ROLE_LABELS: Record<UserItem['role'], string> = {
  super_admin: '超级管理员',
  project_manager: '项目主管',
  pm: '项目经理',
  member: '成员',
  viewer: '访客'
};

function getUserRoleLabel(role: UserItem['role']) {
  return USER_ROLE_LABELS[role] ?? role;
}

const MEMBERSHIP_ROLE_LABELS: Record<'director' | 'manager' | 'member' | 'viewer', string> = {
  director: '项目总监',
  manager: '项目经理',
  member: '项目成员',
  viewer: '只读访客'
};

function getMembershipRoleLabel(role: 'director' | 'manager' | 'member' | 'viewer') {
  return MEMBERSHIP_ROLE_LABELS[role] ?? role;
}

export default function ProjectAccessView({
  users,
  projects,
  canManageUserAccounts,
  canDeleteUserAccounts,
  canManageProjectMembership,
  currentUserId,
  onError,
  onMessage,
  onReloadUsers
}: Props) {
  const [rows, setRows] = useState<ProjectMembershipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    name: '',
    password: '',
    role: 'member' as UserItem['role']
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
    const userLabel = userOptions.find((item) => item.value === form.userId)?.label ?? `用户 #${form.userId}`;
    const projectLabel = projectOptions.find((item) => item.value === form.projectId)?.label ?? `项目 #${form.projectId}`;
    if (!window.confirm(`确认授予 ${userLabel} 在 ${projectLabel} 中的「${getMembershipRoleLabel(form.role)}」权限吗？`)) return;
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
    if (!canManageUserAccounts) return;
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
        role: 'member'
      });
      await onReloadUsers();
    } catch (err) {
      onError(err instanceof Error ? err.message : '创建用户失败');
    }
  };

  const onResetPassword = async (user: UserItem) => {
    if (!canManageUserAccounts) return;
    const next = window.prompt(`为 ${user.username} 设置新密码（至少 6 位）`, '123456');
    if (!next) return;
    if (next.trim().length < 6) {
      onError('密码至少 6 位');
      return;
    }
    if (!window.confirm(`确认将用户 ${user.username} 的密码重置为新值吗？此操作会立即生效。`)) return;
    try {
      await resetUserPassword(user.id, next.trim());
      onMessage(`用户 ${user.username} 密码已重置`);
    } catch (err) {
      onError(err instanceof Error ? err.message : '重置密码失败');
    }
  };

  const onUpdateRole = async (user: UserItem, role: UserItem['role']) => {
    if (!canManageUserAccounts) return;
    if (role === user.role) return;
    if (!window.confirm(`确认将用户 ${user.username} 的角色从「${getUserRoleLabel(user.role)}」调整为「${getUserRoleLabel(role)}」吗？`)) {
      return;
    }
    try {
      setUpdatingUserId(user.id);
      await updateUserRole(user.id, role);
      onMessage(`用户 ${user.username} 角色已更新为 ${getUserRoleLabel(role)}`);
      await onReloadUsers();
    } catch (err) {
      onError(err instanceof Error ? err.message : '更新用户角色失败');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const onDeleteUser = async (user: UserItem) => {
    if (!canDeleteUserAccounts) return;
    if (user.id === currentUserId) {
      onError('不能删除当前登录账号。');
      return;
    }
    if (!window.confirm(`确认删除用户 ${user.username} 吗？此操作不可恢复。`)) return;
    try {
      setUpdatingUserId(user.id);
      await deleteUser(user.id);
      onMessage(`用户 ${user.username} 已删除`);
      await onReloadUsers();
    } catch (err) {
      onError(err instanceof Error ? err.message : '删除用户失败');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="project-access-page">
      {canManageUserAccounts && (
        <div className="card">
          <h3>管理后台 · 用户角色</h3>
          <p className="project-access-hint">
            仅超级管理员/项目主管可管理用户。仅超级管理员可删除账号；不可分配超级管理员。
          </p>
          <div className="form project-access-user-form">
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
            <ThemedSelect
              value={newUserForm.role}
              onChange={(e) => setNewUserForm((prev) => ({ ...prev, role: e.target.value as UserItem['role'] }))}
            >
              {USER_ROLE_OPTIONS.map((item) => (
                <option key={`new-role-${item}`} value={item}>{getUserRoleLabel(item)}</option>
              ))}
            </ThemedSelect>
            <button className="btn btn-primary" type="button" disabled={!canManageUserAccounts} onClick={() => void onCreateUser()}>
              新增用户
            </button>
          </div>
          <table className="table table-wrap project-access-user-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>姓名</th>
                <th>账号</th>
                <th>当前角色</th>
                <th>目标角色</th>
                <th>密码</th>
                <th>删除</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={`user-${u.id}`}>
                  <td>{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.username}</td>
                  <td>{getUserRoleLabel(u.role)}</td>
                  <td>
                    <ThemedSelect
                      value={u.role}
                      disabled={!canManageUserAccounts || updatingUserId === u.id}
                      onChange={(e) => void onUpdateRole(u, e.target.value as UserItem['role'])}
                    >
                      {USER_ROLE_OPTIONS.map((item) => (
                        <option key={item} value={item}>{getUserRoleLabel(item)}</option>
                      ))}
                    </ThemedSelect>
                  </td>
                  <td>
                    <button
                      className="btn btn-small"
                      type="button"
                      disabled={!canManageUserAccounts || updatingUserId === u.id}
                      onClick={() => void onResetPassword(u)}
                    >
                      重置密码
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn btn-small"
                      type="button"
                      disabled={!canDeleteUserAccounts || updatingUserId === u.id || u.id === currentUserId}
                      onClick={() => void onDeleteUser(u)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="project-access-empty-cell">暂无用户数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3>管理后台 · 项目成员授权</h3>
        <p className="project-access-hint">
          用于配置谁能访问哪个项目。项目主管可为所有项目分配成员；项目经理仅可为本人创建的项目分配成员。
        </p>
        <div className="form project-access-form">
          <ThemedSelect value={form.userId} onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}>
            <option value="">选择用户</option>
            {userOptions.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </ThemedSelect>
          <ThemedSelect value={form.projectId} onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))}>
            <option value="">选择项目</option>
            {projectOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </ThemedSelect>
          <ThemedSelect value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as 'director' | 'manager' | 'member' | 'viewer' }))}>
            <option value="director">{getMembershipRoleLabel('director')}</option>
            <option value="manager">{getMembershipRoleLabel('manager')}</option>
            <option value="member">{getMembershipRoleLabel('member')}</option>
            <option value="viewer">{getMembershipRoleLabel('viewer')}</option>
          </ThemedSelect>
          <button className="btn" type="button" disabled={!canManageProjectMembership} onClick={() => void onSubmit()}>
            新增/更新授权
          </button>
        </div>
      </div>

      <div className="card">
        <div className="project-access-list-head">
          <h3 className="project-access-list-title">授权列表</h3>
          <button className="btn btn-small" type="button" onClick={() => void loadRows()} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
        {loading && rows.length === 0 && (
          <AsyncStatePanel
            tone="loading"
            title="正在加载项目授权"
            description="正在同步用户、项目和授权关系。"
          />
        )}
        {!loading && rows.length === 0 && (
          <AsyncStatePanel
            tone="empty"
            title="暂无授权记录"
            description="当前还没有项目成员授权。可以在上方选择用户和项目后创建首条授权。"
            action={(
              <button className="btn btn-small" type="button" onClick={() => void loadRows()}>
                刷新
              </button>
            )}
          />
        )}
        {!loading && rows.length > 0 && (
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
                <td>{getMembershipRoleLabel(row.role)}</td>
                <td>{new Date(row.updatedAt).toLocaleString()}</td>
                <td>
                  <div className="table-row-actions">
                    <button className="btn btn-small btn-ghost-danger" disabled={!canManageProjectMembership} onClick={() => void onRemove(row.id)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
