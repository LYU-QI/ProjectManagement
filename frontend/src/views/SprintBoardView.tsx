import { FormEvent, useEffect, useState } from 'react';
import type { ProjectItem } from '../types';
import ThemedSelect from '../components/ui/ThemedSelect';
import {
  createSprint,
  deleteSprint,
  listSprints,
  Sprint,
  updateSprint
} from '../api/sprint';

type SprintStatus = 'planning' | 'active' | 'completed' | 'cancelled';

type Props = {
  projects: ProjectItem[];
  selectedProjectId: number | null;
  canWrite: boolean;
  feishuUserNames: string[];
  onSelectProject: (id: number | null) => void;
};

const STATUS_COLS: Array<{ key: SprintStatus; label: string }> = [
  { key: 'planning', label: '规划中' },
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' }
];

const STATUS_LABELS: Record<SprintStatus, string> = {
  planning: '规划中',
  active: '进行中',
  completed: '已完成',
  cancelled: '已取消'
};

const STATUS_BADGE: Record<SprintStatus, string> = {
  planning: 'badge-blue',
  active: 'badge-green',
  completed: 'badge-gray',
  cancelled: 'badge-red'
};

const PAGE_SIZE = 50;

export default function SprintBoardView({
  projects,
  selectedProjectId,
  canWrite,
  onSelectProject
}: Props) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [creating, setCreating] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Record<keyof Sprint, string | number>>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!selectedProjectId) {
      setSprints([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await listSprints({ projectId: selectedProjectId, page: 1, limit: PAGE_SIZE });
      setSprints(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [selectedProjectId]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedProjectId) return;
    setCreating(true);
    setError('');
    try {
      await createSprint({
        projectId: selectedProjectId,
        name: createForm.name.trim(),
        goal: createForm.goal.trim() || undefined,
        startDate: createForm.startDate || undefined,
        endDate: createForm.endDate || undefined
      });
      setMessage('迭代已创建。');
      setShowCreate(false);
      setCreateForm({ name: '', goal: '', startDate: '', endDate: '' });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(id: number) {
    if (!selectedProjectId) return;
    setSaving(true);
    setError('');
    try {
      const data: Record<string, unknown> = {};
      const form = editForm;
      if (form.name !== undefined) data.name = String(form.name).trim();
      if (form.goal !== undefined) data.goal = String(form.goal).trim() || undefined;
      if (form.status !== undefined) data.status = form.status;
      if (form.startDate !== undefined) data.startDate = String(form.startDate) || undefined;
      if (form.endDate !== undefined) data.endDate = String(form.endDate) || undefined;
      await updateSprint(id, data as Parameters<typeof updateSprint>[1]);
      setMessage('迭代已更新。');
      setEditingId(null);
      setExpandedId(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sprint: Sprint) {
    if (!window.confirm(`确定删除迭代「${sprint.name}」？`)) return;
    setError('');
    try {
      await deleteSprint(sprint.id);
      setMessage('迭代已删除。');
      setExpandedId((prev) => (prev === sprint.id ? null : prev));
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  }

  function startEdit(sprint: Sprint) {
    setEditingId(sprint.id);
    setEditForm({
      name: sprint.name,
      goal: sprint.goal ?? '',
      status: sprint.status,
      startDate: sprint.startDate ?? '',
      endDate: sprint.endDate ?? ''
    });
    setExpandedId(sprint.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  const byStatus = (status: SprintStatus) => sprints.filter((s) => s.status === status);

  return (
    <div>
      {message && <p className="success-msg">{message}</p>}
      {error && <p className="warn">{error}</p>}

      <div className="sprint-toolbar">
        <span className="sprint-count">
          共 {sprints.length} 个迭代
        </span>
        {canWrite && (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setShowCreate(true)}
            disabled={!selectedProjectId}
          >
            + 新建迭代
          </button>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>新建迭代</h3>
            <form onSubmit={(e) => void handleCreate(e)}>
              <div className="form-group">
                <label>迭代名称 *</label>
                <input
                  className="glass-input"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="例如：第 1 次迭代"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>目标</label>
                <textarea
                  className="glass-input"
                  value={createForm.goal}
                  onChange={(e) => setCreateForm((f) => ({ ...f, goal: e.target.value }))}
                  placeholder="迭代目标描述..."
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>开始日期</label>
                  <input
                    className="glass-input"
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>结束日期</label>
                  <input
                    className="glass-input"
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn" type="button" onClick={() => setShowCreate(false)}>
                  取消
                </button>
                <button className="btn btn-primary" type="submit" disabled={creating}>
                  {creating ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && <p className="muted">加载中...</p>}

      {!selectedProjectId && (
        <div className="card glass-card muted" style={{ textAlign: 'center', padding: '2rem' }}>
          请先在顶部选择项目
        </div>
      )}

      {selectedProjectId && !loading && (
        <div className="sprint-board">
          {STATUS_COLS.map((col) => (
            <div key={col.key} className="sprint-column">
              <div className="sprint-col-header">
                <span className="sprint-col-title">{col.label}</span>
                <span className="sprint-col-count">{byStatus(col.key).length}</span>
              </div>
              <div className="sprint-col-body">
                {byStatus(col.key).map((sprint) => (
                  <div key={sprint.id} className="sprint-card glass-card">
                    <div
                      className="sprint-card-header"
                      onClick={() => setExpandedId((prev) => (prev === sprint.id ? null : sprint.id))}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="sprint-card-name">{sprint.name}</div>
                      <span className={`badge ${STATUS_BADGE[sprint.status]}`}>
                        {STATUS_LABELS[sprint.status]}
                      </span>
                    </div>

                    {sprint.goal && (
                      <div className="sprint-card-goal">{sprint.goal}</div>
                    )}

                    <div className="sprint-card-dates">
                      {sprint.startDate && (
                        <span>开始: {sprint.startDate}</span>
                      )}
                      {sprint.endDate && (
                        <span>结束: {sprint.endDate}</span>
                      )}
                    </div>

                    {expandedId === sprint.id && (
                      <div className="sprint-card-detail">
                        {editingId === sprint.id ? (
                          <div className="sprint-edit-form">
                            <div className="form-group">
                              <label>名称</label>
                              <input
                                className="glass-input"
                                value={editForm.name ?? ''}
                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              />
                            </div>
                            <div className="form-group">
                              <label>目标</label>
                              <textarea
                                className="glass-input"
                                value={editForm.goal ?? ''}
                                onChange={(e) => setEditForm((f) => ({ ...f, goal: e.target.value }))}
                                rows={2}
                              />
                            </div>
                            <div className="form-group">
                              <label>状态</label>
                              <select
                                className="glass-input"
                                value={String(editForm.status ?? sprint.status)}
                                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as SprintStatus }))}
                              >
                                {STATUS_COLS.map((col) => (
                                  <option key={col.key} value={col.key}>
                                    {col.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="form-row">
                              <div className="form-group">
                                <label>开始日期</label>
                                <input
                                  className="glass-input"
                                  type="date"
                                  value={String(editForm.startDate ?? '')}
                                  onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                                />
                              </div>
                              <div className="form-group">
                                <label>结束日期</label>
                                <input
                                  className="glass-input"
                                  type="date"
                                  value={String(editForm.endDate ?? '')}
                                  onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="sprint-edit-actions">
                              <button
                                className="btn btn-primary"
                                onClick={() => void handleUpdate(sprint.id)}
                                disabled={saving}
                              >
                                {saving ? '保存中...' : '保存'}
                              </button>
                              <button className="btn" onClick={cancelEdit}>
                                取消
                              </button>
                              <button
                                className="btn warn"
                                onClick={() => void handleDelete(sprint)}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="sprint-detail-actions">
                            <span className="sprint-id-label">#{sprint.id}</span>
                            {canWrite && (
                              <button
                                className="btn"
                                onClick={() => startEdit(sprint)}
                              >
                                编辑
                              </button>
                            )}
                            <button
                              className="btn"
                              onClick={() => setExpandedId(null)}
                            >
                              收起
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {byStatus(col.key).length === 0 && (
                  <div className="sprint-col-empty">--</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
