import { useEffect, useState } from 'react';
import { listOrgMembers, removeOrgMember, updateOrgMemberRole } from '../api/organizations';
import { useOrgStore } from '../store/useOrgStore';

interface OrgMember {
  userId: number;
  name: string;
  username: string;
  globalRole: string;
  orgRole: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
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
  const [loading, setLoading] = useState(true);

  function loadMembers() {
    if (!activeOrgId) return;
    setLoading(true);
    listOrgMembers(activeOrgId)
      .then(setMembers)
      .catch(() => onError('加载成员列表失败'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMembers(); }, [activeOrgId]);

  async function handleRemove(userId: number, name: string, role: string) {
    if (role === 'owner') { onError('无法移除所有者'); return; }
    if (!confirm(`确定移除成员 ${name}？`)) return;
    if (!activeOrgId) return;
    try {
      await removeOrgMember(activeOrgId, String(userId));
      setMembers(prev => prev.filter(m => m.userId !== userId));
      onMessage(`已移除成员 ${name}`);
    } catch {
      onError('移除失败');
    }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    if (!activeOrgId) return;
    try {
      await updateOrgMemberRole(activeOrgId, String(userId), newRole);
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, orgRole: newRole as OrgMember['orgRole'] } : m));
      onMessage('角色已更新');
    } catch {
      onError('更新角色失败');
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>加载中...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>成员管理</h2>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {members.map(member => (
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
              onChange={e => { if (e.target.value !== member.orgRole) void handleRoleChange(member.userId, e.target.value); }}
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
