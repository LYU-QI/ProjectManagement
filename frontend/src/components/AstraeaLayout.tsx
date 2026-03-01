import React, { ReactNode, useRef, useState, useEffect } from 'react';
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
  Flag
} from 'lucide-react';
import GlobalAiChatbot from './chat/GlobalAiChatbot';

export type ViewKey =
  | 'dashboard'
  | 'requirements'
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
  | 'milestone-board';
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

const navItems: Array<{ id: ViewKey; label: string; icon: ReactNode; platform: PlatformMode; adminOnly?: boolean }> = [
  { id: 'dashboard', label: '总览', icon: <LayoutDashboard size={18} />, platform: 'workspace' },
  { id: 'requirements', label: '项目与需求', icon: <ListTodo size={18} />, platform: 'workspace' },
  { id: 'schedule', label: '进度计划', icon: <CalendarDays size={18} />, platform: 'workspace' },
  { id: 'risks', label: '风险中心', icon: <AlertTriangle size={18} />, platform: 'workspace' },
  { id: 'costs', label: '成本与工时', icon: <CircleDollarSign size={18} />, platform: 'workspace' },
  { id: 'resources', label: '资源视图', icon: <Users size={18} />, platform: 'workspace' },
  { id: 'milestone-board', label: '里程碑看板', icon: <Flag size={18} />, platform: 'workspace' },
  { id: 'ai', label: 'AI 分析', icon: <Bot size={18} />, platform: 'workspace' },
  { id: 'pm-assistant', label: 'PM 助手', icon: <Bot size={18} />, platform: 'workspace' },
  { id: 'feishu', label: '飞书集成', icon: <MessageSquare size={18} />, platform: 'workspace' },
  { id: 'feishu-users', label: '飞书成员', icon: <Users size={18} />, platform: 'admin', adminOnly: true },
  { id: 'audit', label: '审计日志', icon: <Activity size={18} />, platform: 'admin' },
  { id: 'project-access', label: '项目授权', icon: <ShieldCheck size={18} />, platform: 'admin', adminOnly: true },
  { id: 'settings', label: '系统设置', icon: <Settings size={18} />, platform: 'admin' }
];

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
  const canManageAdmin = canAccessAdmin || ['super_admin', 'project_director', 'lead'].includes(role);
  const visibleNavItems = navItems.filter((item) => item.platform === platform && (item.adminOnly ? canManageAdmin : true));

  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showThemeMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThemeMenu]);

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

        <div className="astraea-user-profile-wrap" ref={profileRef}>
          <AnimatePresence>
            {showThemeMenu && (
              <motion.div
                className="user-theme-menu"
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.16 }}
              >
                <div className="user-theme-menu-label">界面主题</div>
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`user-theme-menu-item ${theme === opt.value ? 'is-active' : ''}`}
                    onClick={() => { onThemeChange(opt.value); setShowThemeMenu(false); }}
                    type="button"
                  >
                    <span className="user-theme-emoji">{opt.emoji}</span>
                    <span className="user-theme-name">{opt.label}</span>
                    <span className="user-theme-desc">{opt.desc}</span>
                    {theme === opt.value && <span className="user-theme-check">✓</span>}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div
            className={`astraea-user-profile ${showThemeMenu ? 'is-open' : ''}`}
            onClick={() => setShowThemeMenu((v) => !v)}
            title="点击切换界面主题"
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
    </div>
  );
}
