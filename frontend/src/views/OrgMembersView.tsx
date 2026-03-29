import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api/client';
import { inviteOrgMember, listOrgMembers, removeOrgMember, updateOrgMemberRole } from '../api/organizations';
import { useOrgStore } from '../store/useOrgStore';

interface OrgMember {
  userId: number;
  name: string;
  username: string;
  globalRole: string;
  orgRole: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
}

interface UserItem {
  id: number;
  name: string;
  username: string;
  role: string;
}

interface OrgMembersViewProps {
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
  viewer: '访客'
};

export default function OrgMembersView({ onError, onMessage }: OrgMembersViewProps) {
  const { activeOrgId } = useOrgStore();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addRole, setAddRole] = useState('member');
  const [addingId, setAddingId] = useState<number | null>(null);

  function loadMembers() {
    if (!activeOrgId) return;
    setLoading(true);
    Promise.all([
      listOrgMembers(activeOrgId),
      apiGet<UserItem[]>('/users')
    ])
      .then(([membersData, usersData]) => {
        setMembers(membersData);
        setAllUsers(usersData);
      })
      .catch(() => onError('加载成员列表失败'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMembers(); }, [activeOrgId]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allUsers
      .filter((u) => !memberIds.has(u.id))
      .filter((u) => u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [allUsers, memberIds, search]);

  async function handleAdd(user: UserItem) {
    if (!activeOrgId) return;
    setAddingId(user.id);
    try {
      await inviteOrgMember(activeOrgId, String(user.id), addRole);
      setMembers((prev) => [...prev, {
        userId: user.id,
        name: user.name,
        username: user.username,
        globalRole: user.role,
        orgRole: addRole as OrgMember['orgRole'],
        joinedAt: new Date().toISOString()
      }]);
      setSearch('');
      onMessage(`已添加 ${user.name} 为 ${ROLE_LABELS[addRole]}`);
    } catch {
      onError(`添加成员失败`);
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemove(userId: number, name: string, role: string) {
    if (role === 'owner') { onError('无法移除所有者'); return; }
    if (!confirm(`确定移除成员 ${name}？`)) return;
    if (!activeOrgId) return;
    try {
      await removeOrgMember(activeOrgId, String(userId));
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      onMessage(`已移除成员 ${name}`);
    } catch {
      onError('移除失败');
    }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    if (!activeOrgId) return;
    try {
      await updateOrgMemberRole(activeOrgId, String(userId), newRole);
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, orgRole: newRole as OrgMember['orgRole'] } : m));
      onMessage('角色已更新');
    } catch {
      onError('更新角色失败');
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>加载中...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>成员管理</h2>

      {/* 添加成员 */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 500, marginBottom: '0.75rem', fontSize: '0.9rem', opacity: 0.8 }}>添加成员</div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <input
              className="glass-input"
              placeholder="搜索用户名或姓名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
            {filteredUsers.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 99,
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 10,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  marginTop: 4,
                  maxHeight: 300,
                  overflowY: 'auto',
                }}
              >
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleAdd(u)}
                    disabled={addingId === u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#fff', flexShrink: 0 }}>
                      {u.name.charAt(0)}
                    </span>
                    <span>{u.name}</span>
                    <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>@{u.username}</span>
                    {addingId === u.id && <span style={{ marginLeft: 'auto', opacity: 0.5 }}>添加中...</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            className="glass-input"
            value={addRole}
            onChange={(e) => setAddRole(e.target.value)}
            style={{ minWidth: 90 }}
          >
            {Object.entries(ROLE_LABELS).filter(([v]) => v !== 'owner').map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        {search.trim() && filteredUsers.length === 0 && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.5 }}>未找到匹配用户</p>
        )}
      </div>

      {/* 成员列表 */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {members.map((member) => (
          <div key={member.userId} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: '#fff', flexShrink: 0 }}>
              {member.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500 }}>{member.name}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>@{member.username} · 全局角色: {member.globalRole}</div>
            </div>
            <select
              className="glass-input"
              value={member.orgRole}
              onChange={(e) => { if (e.target.value !== member.orgRole) void handleRoleChange(member.userId, e.target.value); }}
              disabled={member.orgRole === 'owner'}
              style={{ minWidth: 100 }}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {member.orgRole !== 'owner' && (
              <button
                className="btn"
                onClick={() => void handleRemove(member.userId, member.name, member.orgRole)}
                style={{ color: 'var(--color-danger, #ef4444)', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              >
                移除
              </button>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>暂无成员</div>
        )}
      </div>
    </div>
  );
}
