import { useEffect, useState } from 'react';
import { getOrganization, updateOrganization, deleteOrganization } from '../api/organizations';
import { useOrgStore } from '../store/useOrgStore';

interface OrgSettingsViewProps {
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

export default function OrgSettingsView({ onError, onMessage }: OrgSettingsViewProps) {
  const { activeOrgId } = useOrgStore();
  const [org, setOrg] = useState<{ id: string; slug: string; name: string; plan: string; maxMembers: number; memberCount: number } | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    getOrganization(activeOrgId)
      .then(data => {
        setOrg(data);
        setEditName(data.name);
      })
      .catch(() => onError('加载组织信息失败'))
      .finally(() => setLoading(false));
  }, [activeOrgId]);

  async function handleSave() {
    if (!activeOrgId || !org) return;
    setSaving(true);
    try {
      await updateOrganization(activeOrgId, { name: editName });
      setOrg({ ...org, name: editName });
      onMessage('保存成功');
    } catch {
      onError('保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>加载中...</div>;
  if (!org) return <div style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>未选择组织</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: 600 }}>
      <h2 style={{ marginBottom: '1.5rem' }}>组织设置</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>基本信息</h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>组织标识</label>
              <input className="glass-input" value={org.slug} disabled style={{ opacity: 0.6 }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>组织名称</label>
              <input
                className="glass-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>套餐</label>
                <input className="glass-input" value={org.plan} disabled style={{ opacity: 0.6 }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>成员上限</label>
                <input className="glass-input" value={org.maxMembers} disabled style={{ opacity: 0.6 }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>当前成员</label>
                <input className="glass-input" value={org.memberCount} disabled style={{ opacity: 0.6 }} />
              </div>
            </div>
          </div>
          <button
            className="btn primary"
            onClick={handleSave}
            disabled={saving || editName === org.name}
            style={{ marginTop: '1rem', width: '100%' }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
