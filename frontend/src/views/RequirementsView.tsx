import type { FormEvent, KeyboardEvent } from 'react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiPost } from '../api/client';
import type { Requirement, RequirementChange } from '../types';

type InlineEditState<T, Id> = {
  editingId: Id | null;
  editingField: keyof T | null;
  draft: T | null;
  startEdit: (row: T, field?: keyof T) => void;
  updateDraft: (field: keyof T, value: string) => void;
  hasDirty: (original: T) => boolean;
  finalize: (original: T) => void;
  cancel: () => void;
};

type Props = {
  canWrite: boolean;
  requirements: Requirement[];
  selectedRequirementIds: number[];
  onSubmitRequirement: (e: FormEvent<HTMLFormElement>) => void;
  requirementEdit: InlineEditState<Requirement, number>;
  onSaveRequirement: (req: Requirement) => void;
  onReviewRequirement: (id: number, decision: 'approved' | 'rejected') => void;
  onMarkRequirementChanged: (req: Requirement, input: { reason: string; version: string }) => void;
  onShowRequirementChanges: (req: Requirement) => void;
  onDeleteRequirement: (req: Requirement) => void;
  onDeleteSelectedRequirements: () => void;
  onToggleRequirementSelection: (id: number, checked: boolean) => void;
  onSelectAllRequirements: (ids: number[], checked: boolean) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
  requirementChanges: RequirementChange[];
  selectedRequirementForChanges: Requirement | null;
};

export default function RequirementsView({
  canWrite,
  requirements,
  selectedRequirementIds,
  onSubmitRequirement,
  requirementEdit,
  onSaveRequirement,
  onReviewRequirement,
  onMarkRequirementChanged,
  onShowRequirementChanges,
  onDeleteRequirement,
  onDeleteSelectedRequirements,
  onToggleRequirementSelection,
  onSelectAllRequirements,
  onInlineKeyDown,
  requirementChanges,
  selectedRequirementForChanges
}: Props) {
  const [changeDrawer, setChangeDrawer] = useState<{ open: boolean; req: Requirement | null }>({ open: false, req: null });
  const [changeForm, setChangeForm] = useState({ reason: '', version: '' });
  const [changeFilters, setChangeFilters] = useState({ keyword: '', author: '', version: '' });

  // AI 评审状态
  const [aiReviewDrawer, setAiReviewDrawer] = useState<{ open: boolean; req: Requirement | null; loading: boolean; result: string }>({
    open: false, req: null, loading: false, result: ''
  });

  // 调用 AI 评审
  async function triggerAiReview(req: Requirement) {
    setAiReviewDrawer({ open: true, req, loading: true, result: '' });
    try {
      const res = await apiPost<{ review: string; source?: string; error?: string }>('/ai/requirements/review', { id: req.id });
      setAiReviewDrawer((prev) => ({ ...prev, loading: false, result: res.review }));
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setAiReviewDrawer((prev) => ({ ...prev, loading: false, result: `评审失败：${detail}` }));
    }
  }

  const filteredChanges = requirementChanges.filter((change) => {
    if (changeFilters.author && !(change.changedBy || '').includes(changeFilters.author)) return false;
    if (changeFilters.version && !(change.version || '').includes(changeFilters.version)) return false;
    if (changeFilters.keyword) {
      const text = `${change.reason || ''} ${(change.after as any)?.description || ''}`.toLowerCase();
      if (!text.includes(changeFilters.keyword.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div>
      {canWrite && (
        <form className="form" onSubmit={onSubmitRequirement}>
          <input name="title" placeholder="需求标题" required />
          <select name="priority" defaultValue="medium"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
          <input name="description" placeholder="需求描述" required />
          <button className="btn" type="submit">新增需求</button>
        </form>
      )}
      <div className="card" style={{ marginTop: 12 }}>
        {canWrite && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>需求列表</h3>
            <button className="btn" type="button" disabled={selectedRequirementIds.length === 0} onClick={onDeleteSelectedRequirements}>
              批量删除 ({selectedRequirementIds.length})
            </button>
          </div>
        )}
        <table className="table">
          <thead>
            <tr>
              {canWrite && (
                <th>
                  <input
                    type="checkbox"
                    checked={requirements.length > 0 && selectedRequirementIds.length === requirements.length}
                    onChange={(e) => onSelectAllRequirements(requirements.map((r) => r.id), e.target.checked)}
                  />
                </th>
              )}
              <th>ID</th><th>标题</th><th>描述</th><th>优先级</th><th>状态</th><th>变更次数</th>{canWrite && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {requirements.map((r) => {
              const isEditing = requirementEdit.editingId === r.id;
              const rowDraft = isEditing ? (requirementEdit.draft ?? r) : r;
              const isDirty = isEditing && requirementEdit.hasDirty(r);
              return (
                <tr key={r.id} className={isEditing ? 'editing-row' : ''}>
                  {canWrite && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRequirementIds.includes(r.id)}
                        onChange={(e) => onToggleRequirementSelection(r.id, e.target.checked)}
                      />
                    </td>
                  )}
                  <td>{r.id}</td>
                  <td
                    className={isEditing && requirementEdit.editingField === 'title' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && requirementEdit.startEdit(r, 'title')}
                  >
                    {isEditing && requirementEdit.editingField === 'title' ? (
                      <input
                        data-requirement-edit={`${r.id}-title`}
                        value={rowDraft.title ?? ''}
                        onChange={(e) => requirementEdit.updateDraft('title', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveRequirement(r), requirementEdit.cancel)}
                        onBlur={() => requirementEdit.finalize(r)}
                      />
                    ) : (
                      rowDraft.title
                    )}
                  </td>
                  <td
                    className={isEditing && requirementEdit.editingField === 'description' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && requirementEdit.startEdit(r, 'description')}
                  >
                    {isEditing && requirementEdit.editingField === 'description' ? (
                      <input
                        data-requirement-edit={`${r.id}-description`}
                        value={rowDraft.description ?? ''}
                        onChange={(e) => requirementEdit.updateDraft('description', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveRequirement(r), requirementEdit.cancel)}
                        onBlur={() => requirementEdit.finalize(r)}
                      />
                    ) : (
                      rowDraft.description
                    )}
                  </td>
                  <td
                    className={isEditing && requirementEdit.editingField === 'priority' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && requirementEdit.startEdit(r, 'priority')}
                  >
                    {isEditing && requirementEdit.editingField === 'priority' ? (
                      <select
                        data-requirement-edit={`${r.id}-priority`}
                        value={rowDraft.priority ?? 'medium'}
                        onChange={(e) => requirementEdit.updateDraft('priority', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveRequirement(r), requirementEdit.cancel)}
                        onBlur={() => requirementEdit.finalize(r)}
                      >
                        {['low', 'medium', 'high'].map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      rowDraft.priority
                    )}
                  </td>
                  <td
                    className={isEditing && requirementEdit.editingField === 'status' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && requirementEdit.startEdit(r, 'status')}
                  >
                    {isEditing && requirementEdit.editingField === 'status' ? (
                      <select
                        data-requirement-edit={`${r.id}-status`}
                        value={rowDraft.status ?? 'draft'}
                        onChange={(e) => requirementEdit.updateDraft('status', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveRequirement(r), requirementEdit.cancel)}
                        onBlur={() => requirementEdit.finalize(r)}
                      >
                        {['draft', 'in_review', 'approved', 'planned', 'done'].map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      rowDraft.status
                    )}
                  </td>
                  <td>{r.changeCount}</td>
                  {canWrite && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      {isEditing && isDirty ? (
                        <>
                          <button className="btn" type="button" disabled={!isDirty} onClick={() => onSaveRequirement(r)}>保存</button>
                          <button className="btn" type="button" onClick={requirementEdit.cancel}>取消</button>
                        </>
                      ) : (
                        <>
                          <button className="btn" type="button" onClick={() => onReviewRequirement(r.id, 'approved')}>通过</button>
                          <button className="btn" type="button" onClick={() => onReviewRequirement(r.id, 'rejected')}>驳回</button>
                          <button
                            className="btn"
                            type="button"
                            style={{ borderColor: '#00ff88', color: '#00ff88' }}
                            onClick={() => void triggerAiReview(r)}
                          >
                            🤖 AI 评审
                          </button>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => {
                              setChangeDrawer({ open: true, req: r });
                              setChangeForm({ reason: '', version: `v${r.changeCount + 1}.0` });
                            }}
                          >
                            记变更
                          </button>
                          <button className="btn" type="button" onClick={() => onShowRequirementChanges(r)}>
                            {selectedRequirementForChanges?.id === r.id ? '收起变更' : '变更记录'}
                          </button>
                          <button className="btn" type="button" onClick={() => onDeleteRequirement(r)}>删除</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRequirementForChanges && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>变更时间线 - {selectedRequirementForChanges.title}</h3>
          <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 10 }}>
            <input
              placeholder="关键词（原因/说明）"
              value={changeFilters.keyword}
              onChange={(e) => setChangeFilters((prev) => ({ ...prev, keyword: e.target.value }))}
            />
            <input
              placeholder="变更人"
              value={changeFilters.author}
              onChange={(e) => setChangeFilters((prev) => ({ ...prev, author: e.target.value }))}
            />
            <input
              placeholder="版本号"
              value={changeFilters.version}
              onChange={(e) => setChangeFilters((prev) => ({ ...prev, version: e.target.value }))}
            />
          </div>
          <table className="table">
            <thead><tr><th>时间</th><th>版本</th><th>变更人</th><th>原因</th><th>变更字段</th><th>说明</th></tr></thead>
            <tbody>
              {filteredChanges.map((change) => (
                <tr key={change.id}>
                  <td>{new Date(change.createdAt).toLocaleString()}</td>
                  <td>{change.version || '-'}</td>
                  <td>{change.changedBy || '-'}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{change.reason || '-'}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>
                    {['title', 'description', 'priority', 'status', 'version'].map((key) => {
                      const before = (change.before as any)?.[key];
                      const after = (change.after as any)?.[key];
                      if (before === after) return null;
                      return (
                        <div key={key} className="change-field">
                          <span className="change-key">{key}</span>
                          <span className="change-before">{String(before ?? '-')}</span>
                          <span className="change-arrow">→</span>
                          <span className="change-after">{String(after ?? '-')}</span>
                        </div>
                      );
                    })}
                  </td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{(change.after as any)?.description ?? (change.before as any)?.description ?? '-'}</td>
                </tr>
              ))}
              {filteredChanges.length === 0 && (
                <tr><td colSpan={6} style={{ color: 'var(--text-muted)' }}>暂无变更记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {changeDrawer.open && changeDrawer.req && (
        <>
          <div
            className="drawer-backdrop"
            onClick={() => setChangeDrawer({ open: false, req: null })}
          />
          <div className="drawer">
            <div className="drawer-header">
              <h3>需求变更</h3>
              <button className="btn" type="button" onClick={() => setChangeDrawer({ open: false, req: null })}>关闭</button>
            </div>
            <div className="drawer-body">
              <div className="form" style={{ gridTemplateColumns: '1fr' }}>
                <div>
                  <label>需求</label>
                  <input value={changeDrawer.req.title} readOnly />
                </div>
                <div>
                  <label>版本号</label>
                  <input
                    value={changeForm.version}
                    onChange={(e) => setChangeForm((prev) => ({ ...prev, version: e.target.value }))}
                  />
                </div>
                <div>
                  <label>变更原因</label>
                  <textarea
                    rows={4}
                    value={changeForm.reason}
                    onChange={(e) => setChangeForm((prev) => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="drawer-footer">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  onMarkRequirementChanged(changeDrawer.req!, { reason: changeForm.reason, version: changeForm.version });
                  setChangeDrawer({ open: false, req: null });
                }}
              >
                提交变更
              </button>
            </div>
          </div>
        </>
      )}

      {/* AI 评审结果抽屉 */}
      {aiReviewDrawer.open && (
        <>
          <div className="drawer-backdrop" onClick={() => setAiReviewDrawer({ open: false, req: null, loading: false, result: '' })} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <h3 style={{ margin: 0 }}>🤖 AI 需求评审</h3>
                {aiReviewDrawer.req && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {aiReviewDrawer.req.title}
                  </div>
                )}
              </div>
              <button className="btn" type="button" onClick={() => setAiReviewDrawer({ open: false, req: null, loading: false, result: '' })}>关闭</button>
            </div>
            <div className="drawer-body">
              {aiReviewDrawer.loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                  <div>AI 正在评审需求质量，请稍候...</div>
                </div>
              ) : (
                <div style={{
                  padding: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 4,
                  color: '#e0e0e0',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }} className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiReviewDrawer.result || '暂无评审结果'}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
