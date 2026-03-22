import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ListTodo,
  AlertTriangle,
  CircleDollarSign,
  Bot,
  Bell,
  Activity,
  Settings,
  MessageSquare,
  Users,
  CalendarDays,
  ShieldCheck,
  Flag,
  Building2,
  ChevronDown,
  LogOut,
  Plus
} from 'lucide-react';
import { createOrganization, listOrganizations } from '../api/organizations';
import GlobalAiChatbot from './chat/GlobalAiChatbot';
import { useOrgStore } from '../store/useOrgStore';

export type ViewKey =
  | 'dashboard'
  | 'requirements'
  | 'work-items'
  | 'costs'
  | 'schedule'
  | 'resources'
  | 'risks'
  | 'ai'
  | 'notifications'
  | 'audit'
  | 'feishu'
  | 'feishu-users'
  | 'pm-assistant'
  | 'global'
  | 'settings'
  | 'project-access'
  | 'milestone-board'
  | 'org-settings'
  | 'org-members';
export type PlatformMode = 'workspace' | 'admin';
export type ThemeMode = 'light' | 'dark' | 'nebula' | 'forest' | 'sunset' | 'sakura' | 'metal';

const THEME_OPTIONS: Array<{ value: ThemeMode; emoji: string; label: string; desc: string }> = [
  { value: 'light',  emoji: '☀️', label: '极光白', desc: 'Light'  },
  { value: 'dark',   emoji: '🌊', label: '深海蓝', desc: 'Dark'   },
  { value: 'nebula', emoji: '🔮', label: '星云紫', desc: 'Nebula' },
  { value: 'forest', emoji: '🌿', label: '翠林绿', desc: 'Forest' },
  { value: 'sunset', emoji: '🌅', label: '落日橙', desc: 'Sunset' },
  { value: 'sakura', emoji: '🌸', label: '樱花粉', desc: 'Sakura' },
  { value: 'metal',  emoji: '⚙️', label: '金属黑', desc: 'Metal'  },
];

interface AstraeaLayoutProps {
  currentView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  platform: PlatformMode;
  onPlatformChange: (mode: PlatformMode) => void;
  canAccessAdmin: boolean;
  children: ReactNode;
  user: any;
  onLogout: () => void;
  unreadCount?: number;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

const navItems: Array<{ id: ViewKey; label: string; icon: ReactNode; platform: PlatformMode; allowedRoles?: string[] }> = [
  { id: 'dashboard', label: '总览', icon: <LayoutDashboard size={18} />, platform: 'workspace' },
  { id: 'requirements', label: '项目与需求', icon: <ListTodo size={18} />, platform: 'workspace' },
  { id: 'work-items', label: 'Todo / 问题池', icon: <ListTodo size={18} />, platform: 'workspace' },
  { id: 'schedule', label: '进度计划', icon: <CalendarDays size={18} />, platform: 'workspace' },
  { id: 'risks', label: '风险中心', icon: <AlertTriangle size={18} />, platform: 'workspace' },
  { id: 'costs', label: '成本与工时', icon: <CircleDollarSign size={18} />, platform: 'workspace' },
  { id: 'resources', label: '资源视图', icon: <Users size={18} />, platform: 'workspace' },
  { id: 'milestone-board', label: '里程碑看板', icon: <Flag size={18} />, platform: 'workspace' },
  { id: 'ai', label: 'AI 分析', icon: <Bot size={18} />, platform: 'workspace' },
  { id: 'pm-assistant', label: 'PM 助手', icon: <Bot size={18} />, platform: 'workspace' },
  { id: 'feishu', label: '飞书集成', icon: <MessageSquare size={18} />, platform: 'workspace' },
  { id: 'feishu-users', label: '飞书成员', icon: <Users size={18} />, platform: 'admin', allowedRoles: ['super_admin'] },
  { id: 'org-members', label: '成员管理', icon: <Users size={18} />, platform: 'admin', allowedRoles: ['super_admin', 'admin'] },
  { id: 'org-settings', label: '组织设置', icon: <Settings size={18} />, platform: 'admin', allowedRoles: ['super_admin', 'admin'] },
  { id: 'audit', label: '审计日志', icon: <Activity size={18} />, platform: 'admin', allowedRoles: ['super_admin'] },
  { id: 'project-access', label: '项目授权', icon: <ShieldCheck size={18} />, platform: 'admin', allowedRoles: ['super_admin', 'project_manager', 'pm'] },
  { id: 'settings', label: '系统设置', icon: <Settings size={18} />, platform: 'admin', allowedRoles: ['super_admin'] }
];

const HIDDEN_NAV_STORAGE_KEY = 'ui:hidden-nav-items';

export default function AstraeaLayout({
  currentView,
  onViewChange,
  platform,
  onPlatformChange,
  canAccessAdmin,
  children,
  user,
  onLogout,
  unreadCount = 0,
  theme,
  onThemeChange
}: AstraeaLayoutProps) {
  const role = String(user?.role || '');
  const displayName = String(user?.username || user?.name || '未知用户');
  const displayRole = role || 'unknown';
  const canManageAdmin = canAccessAdmin || ['super_admin', 'member', 'pm'].includes(role);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [createSlug, setCreateSlug] = useState('');
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const { activeOrgId, orgList, setActiveOrg } = useOrgStore();
  const [hiddenNavItems, setHiddenNavItems] = useState<ViewKey[]>(() => {
    try {
      const raw = window.localStorage.getItem(HIDDEN_NAV_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const validIds = new Set(navItems.map((item) => item.id));
      return parsed.filter((id): id is ViewKey => typeof id === 'string' && validIds.has(id as ViewKey));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(HIDDEN_NAV_STORAGE_KEY, JSON.stringify(hiddenNavItems));
  }, [hiddenNavItems]);

  const configurableNavItems = useMemo(
    () => {
      return navItems.filter((item) => {
        if (item.platform !== platform) return false;
        if (item.allowedRoles) return item.allowedRoles.includes(role);
        return true;
      });
    },
    [platform, role]
  );
  const visibleNavItems = configurableNavItems.filter((item) => !hiddenNavItems.includes(item.id));

  useEffect(() => {
    if (visibleNavItems.some((item) => item.id === currentView)) return;
    if (visibleNavItems.length > 0) {
      onViewChange(visibleNavItems[0].id);
    }
  }, [currentView, onViewChange, visibleNavItems]);

  function toggleNavItem(id: ViewKey, checked: boolean) {
    setHiddenNavItems((prev) => {
      const hiddenSet = new Set(prev);
      if (checked) {
        hiddenSet.delete(id);
      } else {
        const remainingVisible = configurableNavItems.filter((item) => item.id !== id && !hiddenSet.has(item.id));
        if (remainingVisible.length === 0) return prev;
        hiddenSet.add(id);
      }
      return Array.from(hiddenSet) as ViewKey[];
    });
  }

  async function handleCreateOrg() {
    if (!createSlug.trim() || !createName.trim()) return;
    setCreating(true);
    setCreateMsg(null);
    try {
      const slug = createSlug.trim().toLowerCase().replace(/\s+/g, '-');
      await createOrganization({ slug, name: createName.trim() });
      const orgs = await listOrganizations();
      const { setOrgList, setActiveOrg: _set } = useOrgStore.getState();
      setOrgList(orgs.map(o => ({ id: o.id, name: o.name, orgRole: o.orgRole })));
      setShowCreateOrg(false);
      setCreateSlug('');
      setCreateName('');
    } catch (e: unknown) {
      setCreateMsg({ type: 'error', text: e instanceof Error ? e.message : '创建失败' });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="astraea-root">
      <GlobalAiChatbot onViewChange={onViewChange} />
      <div className="astraea-aurora-bg" />

      <nav className="astraea-sidebar">
        <div className="astraea-brand">
          <h1>ProjectLVQI</h1>
          <div className="astraea-version">PM Console</div>
        </div>
        <div className="astraea-platform-switch">
          <button
            className={`btn astraea-platform-btn ${platform === 'workspace' ? 'active' : ''}`}
            type="button"
            onClick={() => onPlatformChange('workspace')}
          >
            用户平台
          </button>
          <button
            className={`btn astraea-platform-btn ${platform === 'admin' ? 'active' : ''}`}
            type="button"
            disabled={!canManageAdmin}
            onClick={() => onPlatformChange('admin')}
          >
            管理平台
          </button>
        </div>

        {orgList.length > 0 && (
          <div className="org-switcher" style={{ padding: '0.5rem 1rem', position: 'relative' }}>
            <button
              className="btn org-switcher-btn"
              type="button"
              onClick={() => setShowOrgSwitcher(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Building2 size={14} />
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>组织</span>
              </span>
              <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                {orgList.find(o => o.id === activeOrgId)?.name ?? '未选择'}
              </span>
              <ChevronDown size={12} style={{ opacity: 0.6 }} />
            </button>
            <AnimatePresence>
              {showOrgSwitcher && (
                <motion.div
                  className="org-switcher-dropdown"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{
                    position: 'absolute', top: '100%', left: '1rem', right: '1rem',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    zIndex: 100,
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                  }}
                  onMouseLeave={() => setShowOrgSwitcher(false)}
                >
                  {orgList.map(org => (
                    <button
                      key={org.id}
                      className={`org-switcher-item ${org.id === activeOrgId ? 'active' : ''}`}
                      type="button"
                      onClick={() => {
                        setActiveOrg(org.id);
                        setShowOrgSwitcher(false);
                      }}
                      style={{
                        width: '100%', padding: '0.5rem 0.75rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        fontSize: '0.8rem',
                        color: org.id === activeOrgId ? 'var(--color-accent)' : 'var(--color-text)'
                      }}
                    >
                      <span>{org.name}</span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'capitalize' }}>{org.orgRole}</span>
                    </button>
                  ))}

                  {showCreateOrg ? (
                    <div style={{ padding: '0.6rem 0.75rem', borderTop: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => setShowCreateOrg(false)}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.3rem' }}
                        >
                          取消
                        </button>
                        <button
                          className="btn primary"
                          type="button"
                          onClick={() => setShowOrgSwitcher(false)}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.3rem' }}
                        >
                          去创建
                        </button>
                      </div>
                    </div>
                  ) : role === 'super_admin' && (
                    <button
                      type="button"
                      onClick={() => setShowCreateOrg(true)}
                      style={{
                        width: '100%', padding: '0.5rem 0.75rem',
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        fontSize: '0.75rem', color: 'var(--color-accent)',
                        borderTop: '1px solid var(--color-border)'
                      }}
                    >
                      <Plus size={12} />新建组织
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="astraea-nav-list">
          {visibleNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                className={`astraea-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onViewChange(item.id)}
              >
                <div className="icon-wrapper">{item.icon}</div>
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    className="astraea-active-indicator"
                    layoutId="activeNav"
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="astraea-user-profile-wrap">
          <div
            className={`astraea-user-profile ${showUserSettings ? 'is-open' : ''}`}
            onClick={() => setShowUserSettings(true)}
            title="点击打开个性化设置"
            style={{ cursor: 'pointer' }}
          >
            <div className="user-avatar">{displayName.charAt(0).toUpperCase() || 'U'}</div>
            <div className="user-info">
              <span className="user-name">{displayName}</span>
              <span className="user-role">角色：{displayRole}</span>
            </div>
            <button
              className="logout-btn"
              onClick={(e) => { e.stopPropagation(); onLogout(); }}
              title="退出登录"
            >退出</button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {showUserSettings && (
          <motion.div
            className="user-settings-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setShowUserSettings(false)}
          >
            <motion.div
              className="user-settings-modal"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="user-settings-head">
                <h3>界面个性化设置</h3>
                <button className="btn" type="button" onClick={() => setShowUserSettings(false)}>关闭</button>
              </div>

              <section className="user-settings-section">
                <h4>侧栏功能显示</h4>
                <p className="muted">按需隐藏左侧菜单功能，至少保留一个入口。</p>
                <div className="user-settings-nav-grid">
                  {configurableNavItems.map((item) => {
                    const checked = !hiddenNavItems.includes(item.id);
                    return (
                      <label key={item.id} className="user-settings-nav-item">
                        <span className="user-settings-nav-main">
                          <span className="icon-wrapper">{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleNavItem(item.id, e.target.checked)}
                        />
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="user-settings-section">
                <h4>UI 主题</h4>
                <div className="user-theme-menu">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`user-theme-menu-item ${theme === opt.value ? 'is-active' : ''}`}
                      onClick={() => onThemeChange(opt.value)}
                      type="button"
                    >
                      <span className="user-theme-emoji">{opt.emoji}</span>
                      <span className="user-theme-name">{opt.label}</span>
                      <span className="user-theme-desc">{opt.desc}</span>
                      {theme === opt.value && <span className="user-theme-check">✓</span>}
                    </button>
                  ))}
                </div>
              </section>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="astraea-header">
        <div
          className="cmd-k-hint cmd-k-hint--button"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        >
          <span className="hk-key">⌘</span> + <span className="hk-key">K</span> AI 快速入口
        </div>

        <div className="header-actions">
          <button className="action-btn notifications-btn" onClick={() => onViewChange('notifications')}>
            <Bell size={20} />
            {unreadCount > 0 && (
              <motion.span className="badge" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                {unreadCount}
              </motion.span>
            )}
          </button>
        </div>
      </header>

      <main className="astraea-main-container">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="astraea-content-scroll"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 新建组织弹窗 */}
      <AnimatePresence>
        {showCreateOrg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onClick={() => setShowCreateOrg(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '1rem',
                padding: '1.5rem',
                width: 360,
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
              }}
            >
              <h3 style={{ marginBottom: '1rem' }}>新建组织</h3>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.3rem' }}>组织名称</label>
                <input
                  className="glass-input"
                  placeholder="例如：弋途科技"
                  value={createName}
                  onChange={e => {
                    setCreateName(e.target.value);
                    // 自动从名称生成 slug
                    const s = e.target.value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
                    setCreateSlug(s);
                  }}
                  autoFocus
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.3rem' }}>
                  标识 <span style={{ opacity: 0.5 }}>（URL 友好，自动生成）</span>
                </label>
                <input
                  className="glass-input"
                  placeholder="slug"
                  value={createSlug}
                  onChange={e => setCreateSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  style={{ width: '100%' }}
                />
              </div>
              {createMsg && (
                <div style={{
                  fontSize: '0.8rem',
                  color: createMsg.type === 'error' ? '#ef4444' : '#22c55e',
                  marginBottom: '0.75rem'
                }}>
                  {createMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn" type="button" onClick={() => { setShowCreateOrg(false); setCreateMsg(null); }}>
                  取消
                </button>
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => void handleCreateOrg()}
                  disabled={creating || !createSlug.trim() || !createName.trim()}
                >
                  {creating ? '创建中...' : '创建'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
