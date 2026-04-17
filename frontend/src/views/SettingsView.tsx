import { useEffect, useState } from 'react';
import { getConfigItems, saveConfigItems, ConfigItem } from '../api/settings';
import { apiGet } from '../api/client';
import ThemedSelect from '../components/ui/ThemedSelect';
import AsyncStatePanel from '../components/AsyncStatePanel';

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
    theme: 'light' | 'dark' | 'nebula' | 'forest' | 'sunset' | 'sakura' | 'metal';
    onThemeChange: (theme: 'light' | 'dark' | 'nebula' | 'forest' | 'sunset' | 'sakura' | 'metal') => void;
    canRevealSensitive: boolean;
    canSaveConfig: boolean;
}

export default function SettingsView({
    onError,
    onMessage,
    theme,
    onThemeChange,
    canRevealSensitive,
    canSaveConfig
}: SettingsViewProps) {
    const [items, setItems] = useState<ConfigItem[]>([]);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [aiHealthLoading, setAiHealthLoading] = useState(false);
    const [aiHealthResult, setAiHealthResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null);
    const [rawValuesLoaded, setRawValuesLoaded] = useState(false);

    /** 加载配置项 */
    async function loadConfig(reveal = false) {
        setLoading(true);
        try {
            const data = await getConfigItems(reveal && canRevealSensitive);
            setItems(data);
            const vals: Record<string, string> = {};
            for (const item of data) {
                vals[item.key] = item.value;
            }
            setEditValues(vals);
            setHasChanges(false);
            setRawValuesLoaded(reveal && canRevealSensitive);
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
    async function toggleReveal(key: string) {
        if (!canRevealSensitive) {
            onError('仅超级管理员可查看敏感配置原值。');
            return;
        }
        if (!rawValuesLoaded) {
            await loadConfig(true);
        }
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
        if (!canSaveConfig) {
            onError('仅超级管理员可保存系统配置。');
            return;
        }
        const changedItems = items.filter((item) => editValues[item.key] !== item.value);
        const sensitiveChangedItems = changedItems.filter((item) => item.sensitive);
        const confirmMessage = sensitiveChangedItems.length > 0
            ? `确认保存 ${changedItems.length} 项配置变更吗？其中包含 ${sensitiveChangedItems.length} 项敏感配置，部分变更可能需要重启后端服务才能生效。`
            : `确认保存 ${changedItems.length} 项配置变更吗？部分变更可能需要重启后端服务才能生效。`;
        if (!window.confirm(confirmMessage)) {
            return;
        }
        setSaving(true);
        try {
            // 只发送变更的字段
            const updates: Record<string, string> = {};
            for (const item of changedItems) {
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
                await loadConfig(rawValuesLoaded);
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

    function handleResetUiPreferences() {
        if (!confirm('确定重置所有界面偏好设置吗？这会清除表格密度和筛选面板展开状态等本地偏好。')) return;
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (key && key.startsWith('ui:')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach((key) => window.localStorage.removeItem(key));
            onMessage('界面偏好已重置。刷新页面后将按默认布局显示。');
        } catch {
            onError('重置界面偏好失败，请重试。');
        }
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

    async function handleAiHealthCheck() {
        setAiHealthLoading(true);
        setAiHealthResult(null);
        try {
            const res = await apiGet<any>('/ai/health');
            if (res?.ok) {
                setAiHealthResult({
                    ok: true,
                    message: `连通成功（${res.model || 'unknown'}，${res.latencyMs ?? '-'}ms）`,
                    detail: res.sample ? `示例回复：${res.sample}` : undefined,
                });
            } else {
                setAiHealthResult({
                    ok: false,
                    message: res?.message || '连通失败',
                    detail: res?.reason ? `原因：${res.reason}` : undefined,
                });
            }
        } catch (err) {
            setAiHealthResult({
                ok: false,
                message: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setAiHealthLoading(false);
        }
    }

    const groups = getGroups();

    return (
        <div>
            {/* 页面头部 */}
            <div className="card settings-header-card">
                <div className="settings-header-row">
                    <div>
                        <h3 className="settings-title">
                            ⚙️ 系统配置管理
                        </h3>
                        <p className="settings-subtitle">
                            管理 backend/.env 中的环境变量，修改后部分配置需要重启后端服务才能生效。
                        </p>
                        <p className="settings-subtitle">
                            当前权限：所有可访问角色仅可查看掩码配置；仅超级管理员可查看敏感原值并保存。
                        </p>
                    </div>
                    <div className="settings-actions">
                        <ThemedSelect
                            value={theme}
                            onChange={(e) => onThemeChange(e.target.value as 'light' | 'dark' | 'nebula' | 'forest' | 'sunset' | 'sakura' | 'metal')}
                            className="settings-theme-select"
                        >
                            <option value="light">☀️ 极光白（浅色主题）</option>
                            <option value="dark">🌊 深海蓝（深色主题）</option>
                            <option value="nebula">🔮 星云紫（星云风格）</option>
                            <option value="forest">🌿 翠林绿（森林风格）</option>
                            <option value="sunset">🌅 落日橙（暖色风格）</option>
                            <option value="sakura">🌸 樱花粉（柔和粉调）</option>
                            <option value="metal">⚙️ 金属黑（金属质感）</option>
                        </ThemedSelect>
                        <button
                            className="btn settings-mini-btn"
                            type="button"
                            onClick={handleResetUiPreferences}
                        >
                            [ 重置界面偏好 ]
                        </button>
                        <button
                            className={`btn settings-mini-btn ${hasChanges ? '' : 'settings-btn-dim'}`}
                            onClick={handleReset}
                            disabled={!hasChanges}
                        >
                            [ 重置 ]
                        </button>
                        <button
                            className={`btn settings-mini-btn settings-save-btn ${hasChanges ? 'has-changes' : 'settings-btn-dim'}`}
                            onClick={handleSave}
                            disabled={saving || !hasChanges || !canSaveConfig}
                            title={canSaveConfig ? '保存配置' : '仅超级管理员可保存系统配置'}
                        >
                            {saving ? '[ 保存中... ]' : '[ 保存配置 ]'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 配置分组 */}
            {loading && items.length === 0 && (
                <AsyncStatePanel
                    tone="loading"
                    title="正在加载系统配置"
                    description="正在同步环境变量分组、掩码值与权限范围。"
                />
            )}
            {!loading && groups.length === 0 && (
                <AsyncStatePanel
                    tone="empty"
                    title="暂无系统配置项"
                    description="当前没有可展示的配置项，请检查后端配置元数据或权限设置。"
                    action={(
                        <button className="btn" type="button" onClick={() => { void loadConfig(); }}>
                            重新刷新
                        </button>
                    )}
                />
            )}
            {groups.map(({ group, groupLabel, icon, items: groupItems }) => (
                <div key={group} className="card settings-group-card">
                    <div className="settings-group-head">
                        <h4 className="settings-group-title">
                            {icon} {groupLabel}
                        </h4>
                        {group === 'ai' && (
                            <button
                                className="btn settings-mini-btn settings-ai-test-btn"
                                type="button"
                                onClick={() => void handleAiHealthCheck()}
                                disabled={aiHealthLoading}
                            >
                                {aiHealthLoading ? '检测中...' : 'AI 连通性测试'}
                            </button>
                        )}
                    </div>

                    {group === 'ai' && aiHealthResult && (
                        <div className={`settings-health ${aiHealthResult.ok ? 'ok' : 'error'}`}>
                            {aiHealthResult.message}
                            {aiHealthResult.detail && (
                                <div className="settings-health-detail">
                                    {aiHealthResult.detail}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="settings-items">
                        {groupItems.map((item) => {
                            const isRevealed = revealedKeys.has(item.key);
                            const currentValue = editValues[item.key] ?? '';
                            const isModified = currentValue !== item.value;
                            const displayValue = item.sensitive && !isRevealed ? currentValue : currentValue;

                            return (
                                <div
                                    key={item.key}
                                    className={`settings-item-row ${isModified ? 'is-modified' : ''}`}
                                >
                                    {/* 键名和说明 */}
                                    <div>
                                        <div className="settings-item-key">
                                            {item.key}
                                        </div>
                                        <div className="settings-item-desc">
                                            {item.description}
                                        </div>
                                    </div>

                                    {/* 输入框 */}
                                    <input
                                        type={item.sensitive && !isRevealed ? 'password' : 'text'}
                                        value={displayValue}
                                        onChange={(e) => handleChange(item.key, e.target.value)}
                                        className="settings-item-input"
                                        disabled={!canSaveConfig}
                                    />

                                    {/* 操作按钮 */}
                                    <div className="settings-item-actions">
                                        {item.sensitive && (
                                            <button
                                                className="btn settings-item-toggle"
                                                onClick={() => { void toggleReveal(item.key); }}
                                                title={canRevealSensitive ? (isRevealed ? '隐藏' : '显示') : '仅超级管理员可查看'}
                                            >
                                                {canRevealSensitive ? (isRevealed ? '🙈' : '👁️') : '🔒'}
                                            </button>
                                        )}
                                        {isModified && (
                                            <span className="settings-item-modified">
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
            <div className="card settings-footer-tip">
                ⚠️ 注意：修改数据库连接或 JWT 密钥后需要重启后端服务，飞书配置变更即时生效。敏感信息请妥善保管。
            </div>
        </div>
    );
}
