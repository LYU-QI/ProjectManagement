import { useEffect, useState } from 'react';
import { getConfigItems, saveConfigItems, ConfigItem } from '../api/settings';

/** 分组图标映射 */
const GROUP_ICONS: Record<string, string> = {
    database: '🗄️',
    security: '🔐',
    feishu: '🐦',
    ai: '🤖',
};

/** 分组排序 */
const GROUP_ORDER = ['database', 'security', 'feishu', 'ai'];

interface SettingsViewProps {
    onError: (msg: string) => void;
    onMessage: (msg: string) => void;
}

export default function SettingsView({ onError, onMessage }: SettingsViewProps) {
    const [items, setItems] = useState<ConfigItem[]>([]);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    /** 加载配置项 */
    async function loadConfig() {
        setLoading(true);
        try {
            const data = await getConfigItems(true);
            setItems(data);
            const vals: Record<string, string> = {};
            for (const item of data) {
                vals[item.key] = item.value;
            }
            setEditValues(vals);
            setHasChanges(false);
        } catch (err) {
            onError('加载配置项失败，请确认是否有权限。');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadConfig();
    }, []);

    /** 更新单个值 */
    function handleChange(key: string, value: string) {
        setEditValues((prev) => ({ ...prev, [key]: value }));
        // 检查是否有变更
        const original = items.find((i) => i.key === key);
        if (original) {
            setHasChanges(true);
        }
    }

    /** 切换敏感字段显示 */
    function toggleReveal(key: string) {
        setRevealedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }

    /** 保存所有配置 */
    async function handleSave() {
        setSaving(true);
        try {
            // 只发送变更的字段
            const updates: Record<string, string> = {};
            for (const item of items) {
                if (editValues[item.key] !== item.value) {
                    updates[item.key] = editValues[item.key];
                }
            }
            if (Object.keys(updates).length === 0) {
                onMessage('没有需要保存的变更。');
                setSaving(false);
                return;
            }
            const result = await saveConfigItems(updates);
            if (result.success) {
                onMessage(result.message);
                await loadConfig();
            } else {
                onError(result.message);
            }
        } catch (err) {
            onError('保存配置失败。');
        } finally {
            setSaving(false);
        }
    }

    /** 重置编辑 */
    function handleReset() {
        const vals: Record<string, string> = {};
        for (const item of items) {
            vals[item.key] = item.value;
        }
        setEditValues(vals);
        setHasChanges(false);
        setRevealedKeys(new Set());
    }

    /** 按分组组织配置项 */
    function getGroups(): { group: string; groupLabel: string; icon: string; items: ConfigItem[] }[] {
        const groupMap = new Map<string, { groupLabel: string; items: ConfigItem[] }>();
        for (const item of items) {
            if (!groupMap.has(item.group)) {
                groupMap.set(item.group, { groupLabel: item.groupLabel, items: [] });
            }
            groupMap.get(item.group)!.items.push(item);
        }

        return GROUP_ORDER
            .filter((g) => groupMap.has(g))
            .map((g) => ({
                group: g,
                groupLabel: groupMap.get(g)!.groupLabel,
                icon: GROUP_ICONS[g] || '⚙️',
                items: groupMap.get(g)!.items,
            }));
    }

    if (loading && items.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>⚙️</div>
                正在加载系统配置...
            </div>
        );
    }

    const groups = getGroups();

    return (
        <div>
            {/* 页面头部 */}
            <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--neon-cyan, var(--neon-blue))', background: 'rgba(0,15,30,0.6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 16, letterSpacing: 1 }}>
                            ⚙️ 系统配置管理
                        </h3>
                        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                            管理 backend/.env 中的环境变量，修改后部分配置需要重启后端服务才能生效。
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="btn"
                            onClick={handleReset}
                            disabled={!hasChanges}
                            style={{ padding: '6px 14px', fontSize: 11, opacity: hasChanges ? 1 : 0.4 }}
                        >
                            [ 重置 ]
                        </button>
                        <button
                            className="btn"
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            style={{
                                padding: '6px 14px',
                                fontSize: 11,
                                background: hasChanges ? 'rgba(0,255,136,0.15)' : undefined,
                                borderColor: hasChanges ? 'var(--neon-green)' : undefined,
                                color: hasChanges ? 'var(--neon-green)' : undefined,
                                opacity: hasChanges ? 1 : 0.4,
                            }}
                        >
                            {saving ? '[ 保存中... ]' : '[ 保存配置 ]'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 配置分组 */}
            {groups.map(({ group, groupLabel, icon, items: groupItems }) => (
                <div key={group} className="card" style={{ marginBottom: 16 }}>
                    <h4 style={{
                        margin: '0 0 16px',
                        fontSize: 14,
                        letterSpacing: 1,
                        borderBottom: '1px solid var(--border-tech, rgba(0,243,255,0.15))',
                        paddingBottom: 10,
                    }}>
                        {icon} {groupLabel}
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {groupItems.map((item) => {
                            const isRevealed = revealedKeys.has(item.key);
                            const currentValue = editValues[item.key] ?? '';
                            const isModified = currentValue !== item.value;
                            const displayValue = item.sensitive && !isRevealed ? currentValue : currentValue;

                            return (
                                <div
                                    key={item.key}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '200px 1fr auto',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '10px 12px',
                                        borderRadius: 4,
                                        background: isModified ? 'rgba(0,255,136,0.05)' : 'rgba(0,0,0,0.2)',
                                        border: isModified ? '1px solid rgba(0,255,136,0.2)' : '1px solid transparent',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {/* 键名和说明 */}
                                    <div>
                                        <div style={{
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                            fontSize: 12,
                                            color: 'var(--neon-blue)',
                                            fontWeight: 600,
                                            letterSpacing: 0.5,
                                        }}>
                                            {item.key}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                            {item.description}
                                        </div>
                                    </div>

                                    {/* 输入框 */}
                                    <input
                                        type={item.sensitive && !isRevealed ? 'password' : 'text'}
                                        value={displayValue}
                                        onChange={(e) => handleChange(item.key, e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(0,0,0,0.4)',
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                            fontSize: 12,
                                            letterSpacing: 0.3,
                                        }}
                                    />

                                    {/* 操作按钮 */}
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        {item.sensitive && (
                                            <button
                                                className="btn"
                                                onClick={() => toggleReveal(item.key)}
                                                title={isRevealed ? '隐藏' : '显示'}
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: 11,
                                                    minWidth: 'auto',
                                                }}
                                            >
                                                {isRevealed ? '🙈' : '👁️'}
                                            </button>
                                        )}
                                        {isModified && (
                                            <span style={{
                                                fontSize: 10,
                                                color: 'var(--neon-green)',
                                                fontFamily: 'Orbitron, monospace',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                已修改
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* 底部提示 */}
            <div className="card" style={{
                marginTop: 8,
                background: 'rgba(255,200,0,0.05)',
                borderLeft: '3px solid rgba(255,200,0,0.4)',
                fontSize: 12,
                color: 'var(--text-muted)',
            }}>
                ⚠️ 注意：修改数据库连接或 JWT 密钥后需要重启后端服务，飞书配置变更即时生效。敏感信息请妥善保管。
            </div>
        </div>
    );
}
