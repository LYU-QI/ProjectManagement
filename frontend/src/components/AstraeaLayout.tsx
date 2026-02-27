import React, { ReactNode } from 'react';
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
  CalendarDays
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
  | 'settings';

interface AstraeaLayoutProps {
  currentView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  children: ReactNode;
  user: any;
  onLogout: () => void;
  unreadCount?: number;
}

const navItems: Array<{ id: ViewKey; label: string; icon: ReactNode }> = [
  { id: 'dashboard', label: '总览', icon: <LayoutDashboard size={18} /> },
  { id: 'requirements', label: '项目与需求', icon: <ListTodo size={18} /> },
  { id: 'schedule', label: '进度计划', icon: <CalendarDays size={18} /> },
  { id: 'risks', label: '风险中心', icon: <AlertTriangle size={18} /> },
  { id: 'costs', label: '成本与工时', icon: <CircleDollarSign size={18} /> },
  { id: 'resources', label: '资源视图', icon: <Users size={18} /> },
  { id: 'ai', label: 'AI 分析', icon: <Bot size={18} /> },
  { id: 'pm-assistant', label: 'PM 助手', icon: <Bot size={18} /> },
  { id: 'feishu', label: '飞书集成', icon: <MessageSquare size={18} /> },
  { id: 'audit', label: '审计日志', icon: <Activity size={18} /> },
  { id: 'settings', label: '系统设置', icon: <Settings size={18} /> }
];

export default function AstraeaLayout({
  currentView,
  onViewChange,
  children,
  user,
  onLogout,
  unreadCount = 0
}: AstraeaLayoutProps) {
  return (
    <div className="astraea-root">
      <GlobalAiChatbot onViewChange={onViewChange} />
      <div className="astraea-aurora-bg" />

      <nav className="astraea-sidebar">
        <div className="astraea-brand">
          <h1>ProjectLVQI</h1>
          <div className="astraea-version">PM Console</div>
        </div>

        <div className="astraea-nav-list">
          {navItems.map((item) => {
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

        <div className="astraea-user-profile">
          <div className="user-avatar">{user?.username?.charAt(0).toUpperCase() || 'U'}</div>
          <div className="user-info">
            <span className="user-name">{user?.username}</span>
            <span className="user-role">{user?.role}</span>
          </div>
          <button className="logout-btn" onClick={onLogout}>退出</button>
        </div>
      </nav>

      <header className="astraea-header">
        <div
          className="cmd-k-hint"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          style={{ cursor: 'pointer' }}
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
