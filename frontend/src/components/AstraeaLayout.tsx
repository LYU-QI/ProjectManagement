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
  ChevronRight,
  LogOut,
  Bug,
  ClipboardList,
  Layers,
  BookOpen,
  Webhook,
  Key,
  Sparkles
} from 'lucide-react';
import GlobalAiChatbot from './chat/GlobalAiChatbot';

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
  | 'org-members'
  | 'wiki'
  | 'sprints'
  | 'bugs'
  | 'test-plans'
  | 'efficiency'
  | 'webhooks'
  | 'api-keys'
  | 'smart-fill'
  | 'automation'
  | 'capabilities'
  | 'task-center'
  | 'cost-report'
  | 'departments'
  | 'plan-settings';
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
  myOrgRole: string | null;
  children: ReactNode;
  user: any;
  onLogout: () => void;
  unreadCount?: number;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  headerCenter?: ReactNode;
}

interface NavGroup {
  id: string;
  label: string;
  icon: ReactNode;
  items: Array<{ id: ViewKey; label: string; icon: ReactNode }>;
}

const navGroups: NavGroup[] = [
  { id: 'overview', label: '总览', icon: <LayoutDashboard size={14} />, items: [{ id: 'dashboard', label: '总览', icon: <LayoutDashboard size={16} /> }] },
  { id: 'project', label: '项目管理', icon: <ListTodo size={14} />, items: [
    { id: 'requirements', label: '项目与需求', icon: <ListTodo size={16} /> },
    { id: 'work-items', label: 'Todo / 问题池', icon: <ListTodo size={16} /> },
    { id: 'schedule', label: '进度计划', icon: <CalendarDays size={16} /> },
    { id: 'milestone-board', label: '里程碑看板', icon: <Flag size={16} /> },
    { id: 'resources', label: '资源视图', icon: <Users size={16} /> },
    { id: 'sprints', label: 'Sprint', icon: <Layers size={16} /> },
    { id: 'bugs', label: 'Bug 管理', icon: <Bug size={16} /> },
    { id: 'test-plans', label: '测试管理', icon: <ClipboardList size={16} /> },
  ]},
  { id: 'cost-risk', label: '成本与风险', icon: <CircleDollarSign size={14} />, items: [
    { id: 'costs', label: '成本与工时', icon: <CircleDollarSign size={16} /> },
    { id: 'cost-report', label: '成本报告', icon: <CircleDollarSign size={16} /> },
    { id: 'risks', label: '风险中心', icon: <AlertTriangle size={16} /> },
    { id: 'efficiency', label: '效能', icon: <Activity size={16} /> },
  ]},
  { id: 'ai-tools', label: 'AI 与工具', icon: <Sparkles size={14} />, items: [
    { id: 'ai', label: 'AI 分析', icon: <Bot size={16} /> },
    { id: 'pm-assistant', label: 'PM 助手', icon: <Bot size={16} /> },
    { id: 'smart-fill', label: 'AI 智能填报', icon: <Sparkles size={16} /> },
    { id: 'automation', label: '自动化规则', icon: <Sparkles size={16} /> },
    { id: 'task-center', label: '任务中心', icon: <Activity size={16} /> },
    { id: 'capabilities', label: '能力模板', icon: <Sparkles size={16} /> },
    { id: 'webhooks', label: 'Webhook 管理', icon: <Webhook size={16} /> },
    { id: 'api-keys', label: 'API Keys', icon: <Key size={16} /> },
  ]},
  { id: 'collaboration', label: '协作', icon: <MessageSquare size={14} />, items: [
    { id: 'feishu', label: '飞书集成', icon: <MessageSquare size={16} /> },
    { id: 'wiki', label: '知识库', icon: <BookOpen size={16} /> },
    { id: 'notifications', label: '通知', icon: <Bell size={16} /> },
  ]},
  { id: 'admin-org', label: '组织管理', icon: <Building2 size={14} />, items: [
    { id: 'org-members', label: '成员管理', icon: <Users size={16} /> },
    { id: 'org-settings', label: '组织设置', icon: <Settings size={16} /> },
    { id: 'feishu-users', label: '飞书成员', icon: <Users size={16} /> },
    { id: 'departments', label: '部门管理', icon: <Building2 size={16} /> },
  ]},
  { id: 'admin-platform', label: '平台管理', icon: <ShieldCheck size={14} />, items: [
    { id: 'project-access', label: '项目授权', icon: <ShieldCheck size={16} /> },
    { id: 'audit', label: '审计日志', icon: <Activity size={16} /> },
    { id: 'settings', label: '系统设置', icon: <Settings size={16} /> },
    { id: 'plan-settings', label: '套餐设置', icon: <Settings size={16} /> },
  ]},
];

const navItems: Array<{ id: ViewKey; label: string; icon: ReactNode; platform: PlatformMode; allowedOrgRoles?: string[] }> = [
  { id: 'dashboard', label: '总览', icon: <LayoutDashboard size={18} />, platform: 'workspace' },
  { id: 'requirements', label: '项目与需求', icon: <ListTodo size={18} />, platform: 'workspace' },
  { id: 'work-items', label: 'Todo / 问题池', icon: <ListTodo size={18} />, platform: 'workspace' },
  { id: 'schedule', label: '进度计划', icon: <CalendarDays size={18} />, platform: 'workspace' },
  { id: 'risks', label: '风险中心', icon: <AlertTriangle size={18} />, platform: 'workspace' },
  { id: 'costs', label: '成本与工时', icon: <CircleDollarSign size={18} />, platform: 'workspace' },
  { id: 'resources', label: '资源视图', icon: <Users size={18} />, platform: 'workspace' },
  { id: 'milestone-board', label: '里程碑看板', icon: <Flag size={18} />, platform: 'workspace' },
  { id: 'wiki', label: '知识库', icon: <BookOpen size={18} />, platform: 'workspace' },
  { id: 'sprints', label: 'Sprint', icon: <Layers size={18} />, platform: 'workspace' },
  { id: 'bugs', label: 'Bug 管理', icon: <Bug size={18} />, platform: 'workspace' },
  { id: 'test-plans', label: '测试管理', icon: <ClipboardList size={18} />, platform: 'workspace' },
  { id: 'efficiency', label: '效能', icon: <Activity size={18} />, platform: 'workspace' },
  { id: 'ai', label: 'AI 分析', icon: <Bot size={18} />, platform: 'workspace' },
  { id: 'pm-assistant', label: 'PM 助手', icon: <Bot size={18} />, platform: 'workspace' },
  { id: 'smart-fill', label: 'AI 智能填报', icon: <Sparkles size={18} />, platform: 'workspace' },
  { id: 'webhooks', label: 'Webhook 管理', icon: <Webhook size={18} />, platform: 'workspace' },
  { id: 'api-keys', label: 'API Keys', icon: <Key size={18} />, platform: 'workspace' },
  { id: 'automation', label: '自动化规则', icon: <Sparkles size={18} />, platform: 'workspace' },
  { id: 'task-center', label: '任务中心', icon: <Activity size={18} />, platform: 'workspace' },
  { id: 'capabilities', label: '能力模板', icon: <Sparkles size={18} />, platform: 'workspace' },
  { id: 'cost-report', label: '成本报告', icon: <CircleDollarSign size={18} />, platform: 'workspace' },
  { id: 'departments', label: '部门管理', icon: <Building2 size={18} />, platform: 'workspace' },
  { id: 'plan-settings', label: '套餐设置', icon: <Settings size={18} />, platform: 'workspace' },
  { id: 'feishu', label: '飞书集成', icon: <MessageSquare size={18} />, platform: 'workspace' },
  { id: 'notifications', label: '通知', icon: <Bell size={18} />, platform: 'workspace' },
  // admin platform nav items use OrgRole for permission check
  { id: 'feishu-users', label: '飞书成员', icon: <Users size={18} />, platform: 'admin', allowedOrgRoles: ['owner'] },
  { id: 'org-members', label: '成员管理', icon: <Users size={18} />, platform: 'admin', allowedOrgRoles: ['owner', 'admin'] },
  { id: 'org-settings', label: '组织设置', icon: <Settings size={18} />, platform: 'admin', allowedOrgRoles: ['owner', 'admin'] },
  { id: 'audit', label: '审计日志', icon: <Activity size={18} />, platform: 'admin', allowedOrgRoles: ['owner'] },
  { id: 'project-access', label: '项目授权', icon: <ShieldCheck size={18} />, platform: 'admin', allowedOrgRoles: ['owner', 'admin', 'member'] },
  { id: 'settings', label: '系统设置', icon: <Settings size={18} />, platform: 'admin', allowedOrgRoles: ['owner'] }
];

const HIDDEN_NAV_STORAGE_KEY = 'ui:hidden-nav-items';

export default function AstraeaLayout({
  currentView,
  onViewChange,
  platform,
  onPlatformChange,
  canAccessAdmin,
  myOrgRole,
  children,
  user,
  onLogout,
  unreadCount = 0,
  theme,
  onThemeChange,
  headerCenter
}: AstraeaLayoutProps) {
  const role = String(user?.role || '');
  const displayName = String(user?.username || user?.name || '未知用户');
  const displayRole = role || 'unknown';
  const isSuperAdmin = role === 'super_admin';
  const isProjectManager = role === 'project_manager';
  const canManageAdmin = canAccessAdmin || isSuperAdmin || isProjectManager || ['owner', 'admin'].includes(myOrgRole ?? '');
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string>('overview');
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

  // Auto-switch to the group that contains the active view
  useEffect(() => {
    const group = navGroups.find((g) =>
      g.items.some((item) => item.id === currentView)
    );
    if (group) {
      setActiveGroupId(group.id);
    }
  }, [currentView]);

  const configurableNavItems = useMemo(
    () => {
      return navItems.filter((item) => {
        if (item.platform !== platform) return false;
        // super_admin bypasses all org-level role checks
        if (isSuperAdmin) return true;
        // project_manager also bypasses (global role)
        if (isProjectManager) return true;
        // Use OrgRole for admin platform items
        if (item.allowedOrgRoles) return item.allowedOrgRoles.includes(myOrgRole ?? '');
        return true;
      });
    },
    [platform, myOrgRole, isSuperAdmin, isProjectManager]
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

        {/* Workspace: grouped nav titles */}
        {platform === 'workspace' && (
          <div className="astraea-nav-list">
            {navGroups.map((group) => {
              const groupItems = group.items.filter((item) =>
                !hiddenNavItems.includes(item.id) &&
                navItems.some((ni) => ni.id === item.id && ni.platform === 'workspace')
              );
              if (groupItems.length === 0) return null;

              return (
                <button
                  key={group.id}
                  className={`astraea-nav-item ${activeGroupId === group.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveGroupId(group.id);
                    const first = groupItems[0];
                    if (first) onViewChange(first.id);
                  }}
                >
                  <div className="icon-wrapper">{group.icon}</div>
                  <span>{group.label}</span>
                  {activeGroupId === group.id && (
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
        )}

        {/* Admin: flat nav */}
        {platform === 'admin' && (
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
        )}

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

      {/* Right content area: header + topbar tabs + main */}
      <div className="content-area">
        <header className="astraea-header">
          <div className="header-left">
            <div
              className="cmd-k-hint cmd-k-hint--button"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            >
              <span className="hk-key">⌘</span> + <span className="hk-key">K</span> AI 快速入口
            </div>
            {headerCenter && <div className="header-center">{headerCenter}</div>}
          </div>

          <div className="header-actions">
            <div className="app-system-online">
              <span className="app-system-dot"></span>
              SYSTEM.ONLINE
            </div>
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

        {/* Top tab bar: only active group's items */}
        {platform === 'workspace' && (() => {
          const activeGroup = navGroups.find((g) => g.id === activeGroupId);
          if (!activeGroup) return null;
          const groupItems = activeGroup.items.filter((item) =>
            !hiddenNavItems.includes(item.id) &&
            navItems.some((ni) => ni.id === item.id && ni.platform === 'workspace')
          );
          if (groupItems.length === 0) return null;
          return (
            <div className="workspace-tab-bar">
              {groupItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    className={`workspace-tab ${isActive ? 'active' : ''}`}
                    onClick={() => onViewChange(item.id)}
                  >
                    <span className="tab-icon">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
        })()}

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
      </div>

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
                {platform === 'workspace' ? (
                  navGroups.map((group) => {
                    const groupItems = group.items.filter((item) =>
                      navItems.some((ni) => ni.id === item.id && ni.platform === 'workspace')
                    );
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group.id} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, padding: '0.2rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {group.label}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {groupItems.map((item) => {
                            const checked = !hiddenNavItems.includes(item.id);
                            return (
                              <label key={item.id} className="user-settings-nav-item" style={{ marginLeft: 0 }}>
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
                      </div>
                    );
                  })
                ) : (
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
                )}
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
    </div>
  );
}
