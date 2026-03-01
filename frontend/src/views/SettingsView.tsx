import { useEffect, useState } from 'react';
import { getConfigItems, saveConfigItems, ConfigItem } from '../api/settings';
import { apiGet } from '../api/client';
import ThemedSelect from '../components/ui/ThemedSelect';

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
}

export default function SettingsView({ onError, onMessage, theme, onThemeChange }: SettingsViewProps) {
    const [items, setItems] = useState<ConfigItem[]>([]);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [aiHealthLoading, setAiHealthLoading] = useState(false);
    const [aiHealthResult, setAiHealthResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null);

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

    if (loading && items.length === 0) {
        return (
            <div className="card settings-loading-card">
                <div className="settings-loading-icon">⚙️</div>
                正在加载系统配置...
            </div>
        );
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
                    </div>
                    <div className="settings-actions">
                        <ThemedSelect
                            value={theme}
                            onChange={(e) => onThemeChange(e.target.value as 'light' | 'dark' | 'nebula' | 'forest' | 'sunset' | 'sakura' | 'metal')}
                            className="settings-theme-select"
                        >
                            <option value="light">☀️ 极光白（Light）</option>
                            <option value="dark">🌊 深海蓝（Dark）</option>
                            <option value="nebula">🔮 星云紫（Nebula）</option>
                            <option value="forest">🌿 翠林绿（Forest）</option>
                            <option value="sunset">🌅 落日橙（Sunset）</option>
                            <option value="sakura">🌸 樱花粉（Sakura）</option>
                            <option value="metal">⚙️ 金属黑（Metal）</option>
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
                            disabled={saving || !hasChanges}
                        >
                            {saving ? '[ 保存中... ]' : '[ 保存配置 ]'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 配置分组 */}
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
                                    />

                                    {/* 操作按钮 */}
                                    <div className="settings-item-actions">
                                        {item.sensitive && (
                                            <button
                                                className="btn settings-item-toggle"
                                                onClick={() => toggleReveal(item.key)}
                                                title={isRevealed ? '隐藏' : '显示'}
                                            >
                                                {isRevealed ? '🙈' : '👁️'}
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
