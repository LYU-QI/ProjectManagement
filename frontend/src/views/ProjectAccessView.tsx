import { useEffect, useMemo, useState } from 'react';
import { createProjectMembership, listProjectMemberships, removeProjectMembership } from '../api/projectMemberships';
import { createUser, deleteUser, resetUserPassword, updateUserRole } from '../api/users';
import type { UiVisibilityRules } from '../api/settings';
import type { ProjectItem, ProjectMembershipItem, UserItem } from '../types';
import type { ViewKey } from '../components/AstraeaLayout';
import ThemedSelect from '../components/ui/ThemedSelect';
import AsyncStatePanel from '../components/AsyncStatePanel';

type Props = {
  users: UserItem[];
  projects: ProjectItem[];
  uiVisibilityRules: UiVisibilityRules;
  canManageUiVisibility: boolean;
  onSaveUiVisibilityRules: (rules: UiVisibilityRules) => Promise<void>;
  canManageUserAccounts: boolean;
  canDeleteUserAccounts: boolean;
  canManageProjectMembership: boolean;
  currentUserId?: number;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
  onReloadUsers: () => Promise<void>;
};

const USER_ROLE_OPTIONS: UserItem['role'][] = ['super_admin', 'project_manager', 'dept_head', 'pm', 'member', 'viewer'];
type ProjectAccessTab = 'users' | 'roles' | 'matrix' | 'visibility' | 'memberships';
type PermissionType = 'menu' | 'action';

const USER_ROLE_LABELS: Record<UserItem['role'], string> = {
  super_admin: '超级管理员',
  project_manager: '项目主管',
  dept_head: '部门负责人',
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

const ROLE_PROFILES: Array<{
  code: UserItem['role'];
  name: string;
  description: string;
  permissions: string[];
}> = [
  {
    code: 'super_admin',
    name: '超级管理员',
    description: '平台最高权限，可管理用户、系统配置、项目授权和所有业务数据。',
    permissions: [
      'user.manage', 'role.manage', 'config.write', 'audit.read', 'project.manage',
      'requirement.manage', 'task.manage', 'feishu.write', 'cost.manage', 'report.export',
      'automation.manage', 'wiki.manage', 'test.manage', 'defect.manage'
    ]
  },
  {
    code: 'project_manager',
    name: '项目主管',
    description: '组织级项目管理角色，可查看和维护组织内项目及核心协作数据。',
    permissions: [
      'project.manage', 'requirement.manage', 'task.manage', 'feishu.write', 'cost.manage',
      'report.export', 'automation.manage', 'wiki.manage', 'test.manage', 'defect.manage',
      'audit.read'
    ]
  },
  {
    code: 'pm',
    name: '项目经理',
    description: '项目执行负责人，可维护已授权项目的需求、任务、成本和进度。',
    permissions: [
      'project.read', 'requirement.manage', 'task.manage', 'feishu.write', 'cost.manage',
      'report.export', 'wiki.manage', 'test.manage', 'defect.manage'
    ]
  },
  {
    code: 'dept_head',
    name: '部门负责人',
    description: '部门资源负责人，可维护人员资源、资源分配和人员日历例外。',
    permissions: ['project.read', 'resource.read', 'resource.write', 'feishu.write', 'wiki.read']
  },
  {
    code: 'member',
    name: '成员',
    description: '项目成员，可查看并更新参与项目中的任务、缺陷、测试和协作记录。',
    permissions: [
      'project.read', 'requirement.read', 'task.write', 'feishu.write', 'wiki.read',
      'test.write', 'defect.write'
    ]
  },
  {
    code: 'viewer',
    name: '访客',
    description: '只读角色，仅可查看授权范围内的项目、需求、任务和报告。',
    permissions: ['project.read', 'requirement.read', 'task.read', 'feishu.read', 'wiki.read', 'test.read', 'defect.read']
  }
];

const PERMISSION_DEFINITIONS: Array<{
  module: string;
  code: string;
  name: string;
  type: PermissionType;
}> = [
  { module: 'user', code: 'user.manage', name: '管理用户', type: 'action' },
  { module: 'role', code: 'role.manage', name: '管理角色权限', type: 'action' },
  { module: 'config', code: 'config.write', name: '管理系统配置', type: 'action' },
  { module: 'audit', code: 'audit.read', name: '查看审计日志', type: 'menu' },
  { module: 'project', code: 'project.read', name: '查看项目', type: 'menu' },
  { module: 'project', code: 'project.manage', name: '管理项目', type: 'action' },
  { module: 'resource', code: 'resource.read', name: '查看资源', type: 'menu' },
  { module: 'resource', code: 'resource.write', name: '维护资源', type: 'action' },
  { module: 'requirement', code: 'requirement.read', name: '查看需求', type: 'menu' },
  { module: 'requirement', code: 'requirement.manage', name: '管理需求', type: 'action' },
  { module: 'task', code: 'task.read', name: '查看任务', type: 'menu' },
  { module: 'task', code: 'task.write', name: '更新任务', type: 'action' },
  { module: 'task', code: 'task.manage', name: '管理任务', type: 'action' },
  { module: 'feishu', code: 'feishu.read', name: '查看飞书记录', type: 'menu' },
  { module: 'feishu', code: 'feishu.write', name: '同步飞书记录', type: 'action' },
  { module: 'cost', code: 'cost.manage', name: '管理成本工时', type: 'action' },
  { module: 'report', code: 'report.export', name: '导出项目报告', type: 'action' },
  { module: 'automation', code: 'automation.manage', name: '管理自动化规则', type: 'action' },
  { module: 'wiki', code: 'wiki.read', name: '查看知识库', type: 'menu' },
  { module: 'wiki', code: 'wiki.manage', name: '管理知识库', type: 'action' },
  { module: 'test', code: 'test.read', name: '查看测试', type: 'menu' },
  { module: 'test', code: 'test.write', name: '更新测试', type: 'action' },
  { module: 'test', code: 'test.manage', name: '管理测试', type: 'action' },
  { module: 'defect', code: 'defect.read', name: '查看缺陷', type: 'menu' },
  { module: 'defect', code: 'defect.write', name: '更新缺陷', type: 'action' },
  { module: 'defect', code: 'defect.manage', name: '管理缺陷', type: 'action' }
];

const WORKSPACE_SCOPE_OPTIONS: Array<{ id: ViewKey; label: string; group: string }> = [
  { id: 'dashboard', label: '总览', group: '总览' },
  { id: 'resource-maintenance', label: '资源维护台', group: '总览' },
  { id: 'cluster-risk-maintenance', label: '集群风险状态维护台', group: '总览' },
  { id: 'overdue-alerts', label: '延期预警', group: '总览' },
  { id: 'global', label: '全局检索', group: '总览' },
  { id: 'requirements', label: '项目与需求', group: '项目管理' },
  { id: 'work-items', label: '待办 / 问题池', group: '项目管理' },
  { id: 'schedule', label: '进度计划', group: '项目管理' },
  { id: 'milestone-board', label: '里程碑看板', group: '项目管理' },
  { id: 'resources', label: '资源视图', group: '项目管理' },
  { id: 'sprints', label: '迭代管理', group: '项目管理' },
  { id: 'bugs', label: '缺陷管理', group: '项目管理' },
  { id: 'test-plans', label: '测试管理', group: '项目管理' },
  { id: 'costs', label: '成本与工时', group: '成本与风险' },
  { id: 'cost-report', label: '成本报告', group: '成本与风险' },
  { id: 'risks', label: '风险中心', group: '成本与风险' },
  { id: 'efficiency', label: '效能', group: '成本与风险' },
  { id: 'ai', label: 'AI 分析', group: 'AI 与工具' },
  { id: 'pm-assistant', label: 'PM 助手', group: 'AI 与工具' },
  { id: 'smart-fill', label: 'AI 智能填报', group: 'AI 与工具' },
  { id: 'automation', label: '自动化规则', group: 'AI 与工具' },
  { id: 'task-center', label: '任务中心', group: 'AI 与工具' },
  { id: 'capabilities', label: '能力模板', group: 'AI 与工具' },
  { id: 'webhooks', label: '回调管理', group: 'AI 与工具' },
  { id: 'api-keys', label: '访问密钥', group: 'AI 与工具' },
  { id: 'feishu', label: '飞书集成', group: '协作' },
  { id: 'wiki', label: '知识库', group: '协作' },
  { id: 'notifications', label: '通知', group: '协作' },
  { id: 'departments', label: '部门管理', group: '组织管理' },
  { id: 'department-members', label: '部门成员', group: '组织管理' }
];

const ADMIN_SCOPE_OPTIONS: Array<{ id: ViewKey; label: string; group: string }> = [
  { id: 'project-access', label: '项目授权', group: '平台管理' },
  { id: 'audit', label: '审计日志', group: '平台管理' },
  { id: 'settings', label: '系统设置', group: '平台管理' },
  { id: 'feishu-users', label: '飞书成员', group: '组织管理' },
  { id: 'org-members', label: '成员管理', group: '组织管理' },
  { id: 'org-settings', label: '组织设置', group: '组织管理' }
];

const WORKSPACE_GROUPS = Array.from(new Set(WORKSPACE_SCOPE_OPTIONS.map((item) => item.group)));
const ADMIN_GROUPS = Array.from(new Set(ADMIN_SCOPE_OPTIONS.map((item) => item.group)));

function roleHasPermission(role: UserItem['role'], permissionCode: string) {
  const profile = ROLE_PROFILES.find((item) => item.code === role);
  if (!profile) return false;
  const permissions = new Set(profile.permissions);
  const [module, action] = permissionCode.split('.');
  if (permissions.has(permissionCode)) return true;
  if (action !== 'manage' && permissions.has(`${module}.manage`)) return true;
  return false;
}

export default function ProjectAccessView({
  users,
  projects,
  uiVisibilityRules,
  canManageUiVisibility,
  onSaveUiVisibilityRules,
  canManageUserAccounts,
  canDeleteUserAccounts,
  canManageProjectMembership,
  currentUserId,
  onError,
  onMessage,
  onReloadUsers
}: Props) {
  const [activeTab, setActiveTab] = useState<ProjectAccessTab>(canManageUserAccounts ? 'users' : 'roles');
  const [visibilityDraft, setVisibilityDraft] = useState<UiVisibilityRules>(uiVisibilityRules);
  const [savingVisibility, setSavingVisibility] = useState(false);
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

  useEffect(() => {
    if (!canManageUserAccounts && activeTab === 'users') {
      setActiveTab('roles');
    }
  }, [activeTab, canManageUserAccounts]);

  useEffect(() => {
    setVisibilityDraft(uiVisibilityRules);
  }, [uiVisibilityRules]);

  function getRoleVisibility(role: UserItem['role']) {
    return visibilityDraft[role] ?? { workspaceViews: [], adminViews: [], canAccessAdmin: false };
  }

  function hasView(scope: string[], viewId: ViewKey) {
    return scope.includes('*') || scope.includes(viewId);
  }

  function getGroupItems(platform: 'workspaceViews' | 'adminViews', group: string) {
    const source = platform === 'workspaceViews' ? WORKSPACE_SCOPE_OPTIONS : ADMIN_SCOPE_OPTIONS;
    return source.filter((item) => item.group === group);
  }

  function isGroupChecked(role: UserItem['role'], platform: 'workspaceViews' | 'adminViews', group: string) {
    if (role === 'super_admin') return true;
    const rule = getRoleVisibility(role);
    const scope = rule[platform];
    return getGroupItems(platform, group).every((item) => hasView(scope, item.id));
  }

  function toggleVisibilityGroup(role: UserItem['role'], platform: 'workspaceViews' | 'adminViews', group: string, checked: boolean) {
    if (role === 'super_admin') return;
    const groupIds = getGroupItems(platform, group).map((item) => item.id);
    setVisibilityDraft((prev) => {
      const current = prev[role] ?? { workspaceViews: [], adminViews: [], canAccessAdmin: false };
      const currentScope = current[platform].includes('*') ? [] : current[platform];
      const nextScope = checked
        ? Array.from(new Set([...currentScope, ...groupIds]))
        : currentScope.filter((item) => !groupIds.includes(item as ViewKey));
      return {
        ...prev,
        [role]: {
          ...current,
          [platform]: nextScope
        }
      };
    });
  }

  function toggleVisibility(role: UserItem['role'], platform: 'workspaceViews' | 'adminViews', viewId: ViewKey, checked: boolean) {
    if (role === 'super_admin') return;
    setVisibilityDraft((prev) => {
      const current = prev[role] ?? { workspaceViews: [], adminViews: [], canAccessAdmin: false };
      const currentScope = current[platform].includes('*') ? [] : current[platform];
      const nextScope = checked
        ? Array.from(new Set([...currentScope, viewId]))
        : currentScope.filter((item) => item !== viewId);
      return {
        ...prev,
        [role]: {
          ...current,
          [platform]: nextScope
        }
      };
    });
  }

  function toggleAdminAccess(role: UserItem['role'], checked: boolean) {
    if (role === 'super_admin') return;
    setVisibilityDraft((prev) => {
      const current = prev[role] ?? { workspaceViews: [], adminViews: [], canAccessAdmin: false };
      return {
        ...prev,
        [role]: {
          ...current,
          canAccessAdmin: checked,
          adminViews: checked ? current.adminViews : []
        }
      };
    });
  }

  const saveVisibility = async () => {
    if (!canManageUiVisibility) return;
    try {
      setSavingVisibility(true);
      await onSaveUiVisibilityRules(visibilityDraft);
      onMessage('用户可见范围配置已保存');
    } catch (err) {
      onError(err instanceof Error ? err.message : '保存用户可见范围失败');
    } finally {
      setSavingVisibility(false);
    }
  };

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
      <div className="project-access-tabs" role="tablist" aria-label="权限管理视图">
        {[
          ...(canManageUserAccounts ? [{ id: 'users' as const, label: '用户管理' }] : []),
          { id: 'roles' as const, label: '角色列表' },
          { id: 'matrix' as const, label: '权限矩阵' },
          { id: 'visibility' as const, label: '可见范围' },
          { id: 'memberships' as const, label: '项目授权' }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`project-access-tab ${activeTab === tab.id ? 'active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && canManageUserAccounts && (
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
                  <td colSpan={7} className="project-access-empty-cell">
                    <AsyncStatePanel
                      tone="empty"
                      title="暂无用户数据"
                      description="当前组织下还没有可管理的用户账号。"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="card">
          <div className="project-access-list-head">
            <h3 className="project-access-list-title">角色列表</h3>
            <span className="project-access-hint">共 {ROLE_PROFILES.length} 个内置角色</span>
          </div>
          <div className="project-access-role-table-wrap">
            <table className="table table-wrap project-access-role-table">
              <thead>
                <tr>
                  <th>角色编码</th>
                  <th>角色名称</th>
                  <th>说明</th>
                  <th>权限</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_PROFILES.map((role) => (
                  <tr key={role.code}>
                    <td className="mono">{role.code}</td>
                    <td>{role.name}</td>
                    <td>{role.description}</td>
                    <td>
                      <div className="project-access-permission-tags">
                        {role.permissions.map((permission) => (
                          <span className="project-access-permission-tag" key={`${role.code}-${permission}`}>
                            {permission}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-small" type="button" onClick={() => setActiveTab('matrix')}>
                        查看矩阵
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="card">
          <div className="project-access-list-head">
            <div>
              <h3 className="project-access-list-title">角色权限矩阵</h3>
              <p className="project-access-hint">用于核对当前内置角色在菜单和动作上的权限覆盖。</p>
            </div>
            <span className="project-access-hint">
              共 {PERMISSION_DEFINITIONS.length} 项权限，{ROLE_PROFILES.length} 个角色
            </span>
          </div>
          <div className="project-access-matrix-wrap">
            <table className="table project-access-matrix-table">
              <thead>
                <tr>
                  <th>模块</th>
                  <th>权限编码</th>
                  <th>权限名称</th>
                  <th>类型</th>
                  {ROLE_PROFILES.map((role) => (
                    <th key={`matrix-head-${role.code}`}>{role.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_DEFINITIONS.map((permission) => (
                  <tr key={permission.code}>
                    <td className="mono">{permission.module}</td>
                    <td className="mono">{permission.code}</td>
                    <td>{permission.name}</td>
                    <td>{permission.type === 'menu' ? '菜单' : '动作'}</td>
                    {ROLE_PROFILES.map((role) => {
                      const granted = roleHasPermission(role.code, permission.code);
                      return (
                        <td key={`${permission.code}-${role.code}`} className={granted ? 'project-access-yes' : 'project-access-no'}>
                          {granted ? '有' : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'visibility' && (
        <div className="card">
          <div className="project-access-list-head">
            <div>
              <h3 className="project-access-list-title">用户平台可见范围</h3>
              <p className="project-access-hint">按全局角色控制用户平台入口和管理平台入口。超级管理员固定拥有全量可见范围。</p>
            </div>
            <button className="btn btn-primary" type="button" disabled={!canManageUiVisibility || savingVisibility} onClick={() => void saveVisibility()}>
              {savingVisibility ? '保存中...' : '保存配置'}
            </button>
          </div>
          {!canManageUiVisibility && (
            <p className="warn">仅超级管理员可修改可见范围。</p>
          )}
          <div className="project-access-visibility-list">
            {USER_ROLE_OPTIONS.map((role) => {
              const rule = getRoleVisibility(role);
              const adminEnabled = role === 'super_admin' || rule.canAccessAdmin;
              return (
                <section className="project-access-visibility-role" key={`visibility-${role}`}>
                  <div className="project-access-visibility-role-head">
                    <div>
                      <h4>{getUserRoleLabel(role)}</h4>
                      <span className="mono">{role}</span>
                    </div>
                    <label className="project-access-visibility-switch">
                      <input
                        type="checkbox"
                        checked={adminEnabled}
                        disabled={!canManageUiVisibility || role === 'super_admin'}
                        onChange={(e) => toggleAdminAccess(role, e.target.checked)}
                      />
                      <span>允许进入管理平台</span>
                    </label>
                  </div>

                  <div className="project-access-visibility-columns">
                    <div>
                      <h5>用户平台</h5>
                      <div className="project-access-visibility-groups">
                        {WORKSPACE_GROUPS.map((group) => (
                          <label key={`${role}-workspace-group-${group}`} className="project-access-visibility-group">
                            <input
                              type="checkbox"
                              checked={isGroupChecked(role, 'workspaceViews', group)}
                              disabled={!canManageUiVisibility || role === 'super_admin'}
                              onChange={(e) => toggleVisibilityGroup(role, 'workspaceViews', group, e.target.checked)}
                            />
                            <span>{group}</span>
                          </label>
                        ))}
                      </div>
                      <div className="project-access-visibility-options">
                        {WORKSPACE_SCOPE_OPTIONS.map((item) => (
                          <label key={`${role}-workspace-${item.id}`} className="project-access-visibility-option">
                            <input
                              type="checkbox"
                              checked={role === 'super_admin' || hasView(rule.workspaceViews, item.id)}
                              disabled={!canManageUiVisibility || role === 'super_admin'}
                              onChange={(e) => toggleVisibility(role, 'workspaceViews', item.id, e.target.checked)}
                            />
                            <span>{item.label}</span>
                            <small>{item.group}</small>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5>管理平台</h5>
                      <div className="project-access-visibility-groups">
                        {ADMIN_GROUPS.map((group) => (
                          <label key={`${role}-admin-group-${group}`} className="project-access-visibility-group">
                            <input
                              type="checkbox"
                              checked={isGroupChecked(role, 'adminViews', group)}
                              disabled={!canManageUiVisibility || role === 'super_admin' || !adminEnabled}
                              onChange={(e) => toggleVisibilityGroup(role, 'adminViews', group, e.target.checked)}
                            />
                            <span>{group}</span>
                          </label>
                        ))}
                      </div>
                      <div className="project-access-visibility-options">
                        {ADMIN_SCOPE_OPTIONS.map((item) => (
                          <label key={`${role}-admin-${item.id}`} className="project-access-visibility-option">
                            <input
                              type="checkbox"
                              checked={role === 'super_admin' || hasView(rule.adminViews, item.id)}
                              disabled={!canManageUiVisibility || role === 'super_admin' || !adminEnabled}
                              onChange={(e) => toggleVisibility(role, 'adminViews', item.id, e.target.checked)}
                            />
                            <span>{item.label}</span>
                            <small>{item.group}</small>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'memberships' && (
      <>
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
      </>
      )}
    </div>
  );
}
