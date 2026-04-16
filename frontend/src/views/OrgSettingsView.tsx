import { useEffect, useState } from 'react';
import { deleteOrganization, getOrganization, listOrganizations, updateOrganization } from '../api/organizations';
import { useOrgStore } from '../store/useOrgStore';
import { USER_KEY } from '../api/client';
import AsyncStatePanel from '../components/AsyncStatePanel';

function getGlobalRole(): string {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return '';
    return JSON.parse(raw)?.role ?? '';
  } catch {
    return '';
  }
}

interface OrgSettingsViewProps {
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

const PLAN_OPTIONS = [
  { value: 'FREE', label: 'Free 免费版' },
  { value: 'PRO', label: 'Pro 专业版' },
  { value: 'ENTERPRISE', label: 'Enterprise 企业版' },
];

export default function OrgSettingsView({ onError, onMessage }: OrgSettingsViewProps) {
  const { activeOrgId, orgList, setActiveOrg, setOrgList } = useOrgStore();
  const [org, setOrg] = useState<{ id: string; slug: string; name: string; plan: string; maxMembers: number; memberCount: number } | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editMaxMembers, setEditMaxMembers] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 从 orgList 获取用户在当前组织的角色
  const myOrgRole = orgList.find(o => o.id === activeOrgId)?.orgRole ?? '';
  const globalRole = getGlobalRole();

  // owner/admin/super_admin 可编辑组织名称；套餐和成员上限仅 super_admin 可改
  const canEditName = ['owner', 'admin'].includes(myOrgRole) || globalRole === 'super_admin';
  const canEditPlanAndQuota = globalRole === 'super_admin';

  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    getOrganization(activeOrgId)
      .then(data => {
        setOrg(data);
        setEditName(data.name);
        setEditPlan(data.plan);
        setEditMaxMembers(data.maxMembers);
      })
      .catch(() => onError('加载组织信息失败'))
      .finally(() => setLoading(false));
  }, [activeOrgId]);

  function hasChanges() {
    if (!org) return false;
    const nameChanged = canEditName && editName !== org.name;
    const planChanged = canEditPlanAndQuota && editPlan !== org.plan;
    const quotaChanged = canEditPlanAndQuota && editMaxMembers !== org.maxMembers;
    return nameChanged || planChanged || quotaChanged;
  }

  async function handleSave() {
    if (!activeOrgId || !org) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {};
      if (canEditName && editName !== org.name) data.name = editName;
      if (canEditPlanAndQuota && editPlan !== org.plan) data.plan = editPlan;
      if (canEditPlanAndQuota && editMaxMembers !== org.maxMembers) data.maxMembers = editMaxMembers;
      if (Object.keys(data).length === 0) return;
      await updateOrganization(activeOrgId, data as { name?: string; plan?: string; maxMembers?: number });
      setOrg({ ...org, ...data as { name: string; plan: string; maxMembers: number } });
      onMessage('保存成功');
    } catch {
      onError('保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeOrgId) return;
    setDeleting(true);
    try {
      await deleteOrganization(activeOrgId);
      // 切换到其他组织
      const others = orgList.filter(o => o.id !== activeOrgId);
      if (others.length > 0) {
        setActiveOrg(others[0].id);
      } else {
        // 如果没有其他组织了，重新加载列表
        const fresh = await listOrganizations();
        setOrgList(fresh.map(o => ({ id: o.id, name: o.name, orgRole: o.orgRole })));
      }
      onMessage('组织已删除');
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: 720 }}>
        <AsyncStatePanel
          tone="loading"
          title="正在加载组织设置"
          description="正在同步组织信息、套餐和成员上限配置。"
        />
      </div>
    );
  }

  if (!org) {
    return (
      <div style={{ padding: '2rem', maxWidth: 720 }}>
        <AsyncStatePanel
          tone="empty"
          title="未选择组织"
          description="请先选择一个组织后，再查看或编辑组织设置。"
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 600 }}>
      <h2 style={{ marginBottom: '1.5rem' }}>组织设置</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>基本信息</h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>
                组织标识 <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>（slug，用于 URL）</span>
              </label>
              <input className="glass-input" value={org.slug} disabled style={{ opacity: 0.6 }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>组织名称</label>
              {canEditName ? (
                <input
                  className="glass-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              ) : (
                <input className="glass-input" value={org.name} disabled style={{ opacity: 0.6 }} />
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>套餐</label>
                {canEditPlanAndQuota ? (
                  <select
                    className="glass-input"
                    value={editPlan}
                    onChange={e => setEditPlan(e.target.value)}
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    {PLAN_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input className="glass-input" value={org.plan} disabled style={{ opacity: 0.6 }} />
                )}
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>成员上限</label>
                {canEditPlanAndQuota ? (
                  <input
                    className="glass-input"
                    type="number"
                    min={1}
                    value={editMaxMembers}
                    onChange={e => setEditMaxMembers(Number(e.target.value))}
                  />
                ) : (
                  <input className="glass-input" value={org.maxMembers} disabled style={{ opacity: 0.6 }} />
                )}
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
            disabled={saving || !hasChanges()}
            style={{ marginTop: '1rem', width: '100%' }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>

        {/* 删除组织 - 仅 owner 可操作 */}
        {(myOrgRole === 'owner' || globalRole === 'super_admin') && (
          <div className="glass-card" style={{ padding: '1.5rem', borderColor: 'rgba(239,68,68,0.3)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#ef4444' }}>危险操作</h3>
            {confirmDelete ? (
              <div>
                <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  确定删除组织「{org.name}」吗？此操作不可恢复，关联的项目和数据将被一并清除。
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn"
                    onClick={() => setConfirmDelete(false)}
                    style={{ flex: 1 }}
                  >
                    取消
                  </button>
                  <button
                    className="btn"
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none' }}
                  >
                    {deleting ? '删除中...' : '确认删除'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn"
                onClick={() => setConfirmDelete(true)}
                style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}
              >
                删除组织
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
