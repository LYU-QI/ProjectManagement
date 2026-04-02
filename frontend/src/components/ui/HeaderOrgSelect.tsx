import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useOrgStore } from '../../store/useOrgStore';
import { createOrganization, listOrganizations } from '../../api/organizations';

interface Props {
  isSuperAdmin: boolean;
}

export default function HeaderOrgSelect({ isSuperAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { orgList, activeOrgId, setActiveOrg, setOrgList } = useOrgStore();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleCreate() {
    if (!name.trim() || !slug.trim()) return;
    setCreating(true);
    setMsg(null);
    try {
      await createOrganization({ slug: slug.trim().toLowerCase().replace(/\s+/g, '-'), name: name.trim() });
      const orgs = await listOrganizations();
      setOrgList(orgs.map(o => ({ id: o.id, name: o.name, orgRole: o.orgRole })));
      setShowCreate(false);
      setName('');
      setSlug('');
    } catch (e: unknown) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : '创建失败' });
    } finally {
      setCreating(false);
    }
  }

  const activeOrg = orgList.find(o => o.id === activeOrgId);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '5px 10px',
          height: 36,
          fontSize: '0.82rem',
          fontWeight: 600,
          fontFamily: 'inherit',
          background: `
            linear-gradient(155deg,
              color-mix(in srgb, var(--glass-specular) 34%, transparent 66%),
              transparent 38%),
            var(--glass-bg)
          `,
          border: '1px solid var(--glass-border)',
          borderRadius: 12,
          color: 'var(--text-on-glass-primary)',
          cursor: 'pointer',
          outline: 'none',
          backdropFilter: 'saturate(140%) blur(var(--glass-blur))',
          WebkitBackdropFilter: 'saturate(140%) blur(var(--glass-blur))',
          boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--glass-specular) 48%, transparent 52%)',
        }}
      >
        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>组织</span>
        <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
          {activeOrg?.name ?? '未选择'}
        </span>
        <ChevronDown size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, minWidth: 200, zIndex: 300 }}>
          <div style={{
            borderRadius: 14,
            border: '1px solid color-mix(in srgb, var(--color-primary) 30%, var(--glass-border) 70%)',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: `
              linear-gradient(170deg, color-mix(in srgb, var(--glass-specular) 20%, transparent 80%), transparent 44%),
              color-mix(in srgb, var(--glass-bg) 90%, var(--color-bg-surface) 10%)
            `,
            boxShadow: '0 18px 36px color-mix(in srgb, #000000 36%, transparent 64%)',
            backdropFilter: 'saturate(130%) blur(var(--glass-blur))',
            WebkitBackdropFilter: 'saturate(130%) blur(var(--glass-blur))',
          }}>
            {orgList.map(org => (
              <button
                key={org.id}
                type="button"
                onClick={() => { setActiveOrg(org.id); setOpen(false); }}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  width: '100%',
                  minHeight: 38,
                  borderRadius: 12,
                  border: `1px solid ${org.id === activeOrgId
                    ? 'color-mix(in srgb, var(--color-primary) 60%, var(--glass-border) 40%)'
                    : 'color-mix(in srgb, var(--color-primary) 34%, var(--glass-border) 66%)'
                  }`,
                  background: org.id === activeOrgId
                    ? `linear-gradient(160deg, color-mix(in srgb, var(--glass-specular) 22%, transparent 78%), transparent 42%), color-mix(in srgb, var(--glass-bg) 74%, var(--color-bg-surface) 26%)`
                    : 'transparent',
                  color: 'var(--text-on-glass-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '0 12px',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  if (org.id !== activeOrgId) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--glass-bg-hover) 50%, transparent 50%)';
                  }
                }}
                onMouseLeave={e => {
                  if (org.id !== activeOrgId) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }
                }}
              >
                <span>{org.name}</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'capitalize' }}>{org.orgRole}</span>
              </button>
            ))}

            {isSuperAdmin && (showCreate ? (
              <div style={{ padding: '4px 0', borderTop: '1px solid var(--glass-border)', marginTop: 2 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 4px 0' }}>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="组织名称"
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      background: 'color-mix(in srgb, var(--glass-bg) 60%, transparent 40%)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 8,
                      color: 'var(--text-on-glass-primary)',
                      outline: 'none',
                    }}
                  />
                  <input
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    placeholder="slug (英文/数字/-)"
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      background: 'color-mix(in srgb, var(--glass-bg) 60%, transparent 40%)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 8,
                      color: 'var(--text-on-glass-primary)',
                      outline: 'none',
                    }}
                  />
                  {msg && <div style={{ fontSize: 11, color: msg.type === 'error' ? 'var(--color-danger, #ef4444)' : 'var(--color-success, #10b981)', textAlign: 'center' }}>{msg.text}</div>}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => { setShowCreate(false); setMsg(null); }}
                      style={{
                        flex: 1, padding: '5px 0', fontSize: 11, fontFamily: 'inherit',
                        background: 'transparent', border: '1px solid var(--glass-border)',
                        borderRadius: 8, color: 'var(--text-on-glass-secondary)', cursor: 'pointer',
                      }}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={creating || !name.trim() || !slug.trim()}
                      style={{
                        flex: 1, padding: '5px 0', fontSize: 11, fontFamily: 'inherit',
                        background: 'var(--color-primary)', border: 'none',
                        borderRadius: 8, color: '#fff', cursor: creating ? 'not-allowed' : 'pointer',
                        opacity: creating ? 0.6 : 1,
                      }}
                    >
                      {creating ? '创建中...' : '创建'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  width: '100%',
                  minHeight: 38,
                  borderRadius: 12,
                  border: '1px dashed color-mix(in srgb, var(--color-primary) 40%, var(--glass-border) 60%)',
                  background: 'transparent',
                  color: 'var(--text-on-glass-secondary)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '0 12px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--glass-bg-hover) 40%, transparent 60%)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <Plus size={14} />
                创建组织
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
