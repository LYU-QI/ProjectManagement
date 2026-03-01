import { FormEvent, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPatch } from '../api/client';

export type FeishuUserItem = {
    id: number;
    name: string;
    openId: string;
    createdAt: string;
};

interface FeishuUsersViewProps {
    canWrite: boolean;
}

export default function FeishuUsersView({ canWrite }: FeishuUsersViewProps) {
    const [users, setUsers] = useState<FeishuUserItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // Edit states
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editOpenId, setEditOpenId] = useState('');

    async function loadUsers() {
        setLoading(true);
        setError('');
        try {
            const res = await apiGet<FeishuUserItem[]>('/feishu-users');
            setUsers(res);
        } catch (err) {
            const detail = err instanceof Error ? err.message : 'Unknown error';
            setError(`加载负责人数据失败: ${detail}`);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadUsers();
    }, []);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!canWrite) return;

        setError('');
        setMessage('');

        const target = e.currentTarget;
        const form = new FormData(target);
        const name = String(form.get('name') || '').trim();
        const openId = String(form.get('openId') || '').trim();

        if (!name || !openId) {
            setError('显示名称和飞书 OpenID 为必填项。');
            return;
        }

        try {
            await apiPost('/feishu-users', { name, openId });
            setMessage(`成功添加负责人: ${name}`);
            target.reset();
            await loadUsers();
        } catch (err) {
            const detail = err instanceof Error ? err.message : 'Unknown error';
            setError(`添加负责人失败: ${detail}`);
        }
    }

    async function handleDelete(id: number, name: string) {
        if (!canWrite) return;
        if (!confirm(`确定要移除负责人“${name}”吗？这将影响未来的任务指派同步。`)) return;

        setError('');
        setMessage('');

        try {
            await apiDelete(`/feishu-users/${id}`);
            setMessage(`成功移除负责人: ${name}`);
            await loadUsers();
        } catch (err) {
            const detail = err instanceof Error ? err.message : 'Unknown error';
            setError(`移除负责人失败: ${detail}`);
        }
    }

    function startEdit(user: FeishuUserItem) {
        if (!canWrite) return;
        setEditingId(user.id);
        setEditName(user.name);
        setEditOpenId(user.openId);
    }

    function cancelEdit() {
        setEditingId(null);
    }

    async function saveEdit(id: number) {
        if (!canWrite) return;
        setError('');
        setMessage('');

        if (!editName.trim() || !editOpenId.trim()) {
            setError('名称和 OpenID 均不可为空。');
            return;
        }

        try {
            await apiPatch(`/feishu-users/${id}`, { name: editName.trim(), openId: editOpenId.trim() });
            setMessage(`成功更新负责人: ${editName}`);
            setEditingId(null);
            await loadUsers();
        } catch (err) {
            const detail = err instanceof Error ? err.message : 'Unknown error';
            setError(`更新负责人失败: ${detail}`);
        }
    }

    return (
        <div className="card feishu-users-card">
            <h2 className="feishu-users-title">飞书组员名册</h2>
            <p className="feishu-users-desc">
                维护此列表可实现业务负责人（如“张三”）和飞书内部 `open_id`（如 `ou_xxxx`）间的安全匹配。这替代了旧版的全局环境变量硬编码。
            </p>

            {error && <div className="warn feishu-users-alert">{error}</div>}
            {message && <div className="feishu-users-success">{message}</div>}

            {canWrite && (
                <form onSubmit={(e) => void handleSubmit(e)} className="feishu-users-form">
                    <div>
                        <label className="feishu-users-label">显示名称 (表格显示)</label>
                        <input type="text" name="name" className="input" placeholder="例如：李四" required />
                    </div>
                    <div>
                        <label className="feishu-users-label">飞书 Open ID</label>
                        <input type="text" name="openId" className="input" placeholder="例如：ou_1234abcd5678..." required />
                    </div>
                    <div className="feishu-users-form-actions">
                        <button type="submit" className="btn btn-primary">新增</button>
                    </div>
                </form>
            )}

            {loading ? (
                <p>加载中...</p>
            ) : (
                <table className="table">
                    <thead>
                        <tr>
                            <th className="feishu-users-col-id">ID</th>
                            <th>显示名称</th>
                            <th>飞书 Open ID</th>
                            {canWrite && <th className="feishu-users-col-actions">操作</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={canWrite ? 4 : 3} className="feishu-users-empty">
                                    暂未登记任何负责人映射。
                                </td>
                            </tr>
                        ) : (
                            users.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.id}</td>
                                    <td>
                                        {editingId === u.id ? (
                                            <input
                                                className="input"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') void saveEdit(u.id);
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                            />
                                        ) : (
                                            u.name
                                        )}
                                    </td>
                                    <td>
                                        {editingId === u.id ? (
                                            <input
                                                className="input"
                                                value={editOpenId}
                                                onChange={(e) => setEditOpenId(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') void saveEdit(u.id);
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                            />
                                        ) : (
                                            <code className="feishu-users-openid">{u.openId}</code>
                                        )}
                                    </td>
                                    {canWrite && (
                                        <td>
                                            {editingId === u.id ? (
                                                <div className="feishu-users-row-actions">
                                                    <button className="btn btn-primary btn-small" onClick={() => void saveEdit(u.id)}>保存</button>
                                                    <button className="btn btn-small" onClick={cancelEdit}>取消</button>
                                                </div>
                                            ) : (
                                                <div className="feishu-users-row-actions">
                                                    <button className="btn btn-small" onClick={() => startEdit(u)}>编辑</button>
                                                    <button className="btn btn-small btn-danger" onClick={() => void handleDelete(u.id, u.name)}>删除</button>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}
