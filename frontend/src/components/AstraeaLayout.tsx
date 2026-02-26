import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    ListTodo,
    CircleDollarSign,
    CalendarDays,
    Users,
    AlertTriangle,
    Bot,
    Settings,
    Bell,
    Activity,
    MessageSquare
} from 'lucide-react';
import GlobalAiChatbot from './chat/GlobalAiChatbot';

export type ViewKey = 'dashboard' | 'requirements' | 'costs' | 'schedule' | 'resources' | 'risks' | 'ai' | 'notifications' | 'audit' | 'feishu' | 'feishu-users' | 'pm-assistant' | 'global' | 'settings';

interface AstraeaLayoutProps {
    currentView: ViewKey;
    onViewChange: (view: ViewKey) => void;
    children: ReactNode;
    user: any;
    onLogout: () => void;
    unreadCount?: number;
}

const navItems = [
    { id: 'dashboard', label: '指挥中心', icon: <LayoutDashboard size={18} /> },
    { id: 'requirements', label: '需求流', icon: <ListTodo size={18} /> },
    { id: 'costs', label: '成本池', icon: <CircleDollarSign size={18} /> },
    { id: 'schedule', label: '进度轴', icon: <CalendarDays size={18} /> },
    { id: 'resources', label: '资源阵列', icon: <Users size={18} /> },
    { id: 'risks', label: '风险雷达', icon: <AlertTriangle size={18} /> },
    { id: 'feishu', label: '飞书神经元', icon: <MessageSquare size={18} /> },
    { id: 'pm-assistant', label: 'PMO 大脑', icon: <Bot size={18} /> },
    { id: 'audit', label: '审计轨迹', icon: <Activity size={18} /> },
    { id: 'settings', label: '系统设置', icon: <Settings size={18} /> },
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
            {/* 全局悬浮 AI 通信器 */}
            <GlobalAiChatbot onViewChange={onViewChange} />

            {/* 极光背景层 */}
            <div className="astraea-aurora-bg"></div>

            {/* 悬浮侧边栏 */}
            <nav className="astraea-sidebar">
                <div className="astraea-brand">
                    <div className="astraea-logo-glow"></div>
                    <h1>Astraea<span>Flow</span></h1>
                    <div className="astraea-version">v2.0 AI Core</div>
                </div>

                <div className="astraea-nav-list">
                    {navItems.map((item) => {
                        const isActive = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                className={`astraea-nav-item ${isActive ? 'active' : ''}`}
                                onClick={() => onViewChange(item.id as ViewKey)}
                            >
                                <div className="icon-wrapper">
                                    {item.icon}
                                </div>
                                <span>{item.label}</span>
                                {isActive && (
                                    <motion.div
                                        className="astraea-active-indicator"
                                        layoutId="activeNav"
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="astraea-user-profile">
                    <div className="user-avatar">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="user-info">
                        <span className="user-name">{user?.username}</span>
                        <span className="user-role">{user?.role}</span>
                    </div>
                    <button className="logout-btn" onClick={onLogout}>退出</button>
                </div>
            </nav>

            {/* 顶部控制栏 & 消息流 */}
            <header className="astraea-header">
                <div
                    className="cmd-k-hint"
                    onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                    style={{ cursor: 'pointer' }}
                >
                    <span className="hk-key">⌘</span> + <span className="hk-key">K</span> 呼出 AI 助理
                </div>

                <div className="header-actions">
                    <button
                        className="action-btn notifications-btn"
                        onClick={() => onViewChange('notifications')}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <motion.span
                                className="badge"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                            >
                                {unreadCount}
                            </motion.span>
                        )}
                    </button>
                </div>
            </header>

            {/* 主内容玻璃容器 */}
            <main className="astraea-main-container">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentView}
                        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                        transition={{ duration: 0.25 }}
                        className="astraea-content-scroll"
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}
