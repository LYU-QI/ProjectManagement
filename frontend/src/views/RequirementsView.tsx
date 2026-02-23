import type { FormEvent, KeyboardEvent } from 'react';
import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiPost, TOKEN_KEY } from '../api/client';
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
  selectedProjectId?: number | null;
  onImportSuccess?: () => void;
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
  selectedRequirementForChanges,
  selectedProjectId,
  onImportSuccess
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

  // 需求导入状态
  type ParsedReq = { title: string; description: string; priority: string };
  const [importModal, setImportModal] = useState<{ open: boolean; file: File | null; loading: boolean; error: string; result: ParsedReq[] | null }>({
    open: false, file: null, loading: false, error: '', result: null
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportUpload = async () => {
    if (!importModal.file) return;
    setImportModal(p => ({ ...p, loading: true, error: '', result: null }));
    try {
      const formData = new FormData();
      formData.append('file', importModal.file);

      const res = await fetch('http://localhost:3000/api/v1/ai/requirements/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`
        },
        body: formData
      });

      if (!res.ok) {
        let msg = res.statusText;
        try { const errObj = await res.json(); msg = errObj.message || msg; } catch { }
        throw new Error(msg);
      }

      const data = await res.json() as ParsedReq[];
      setImportModal(p => ({ ...p, loading: false, result: data }));
    } catch (err) {
      setImportModal(p => ({ ...p, loading: false, error: err instanceof Error ? err.message : String(err) }));
    }
  };

  const handleConfirmImport = async () => {
    if (!importModal.result || !selectedProjectId) return;
    setImportModal(p => ({ ...p, loading: true, error: '' }));
    try {
      await Promise.all(importModal.result.map(req =>
        apiPost('/requirements', {
          projectId: selectedProjectId,
          title: req.title,
          description: req.description,
          priority: req.priority
        })
      ));
      setImportModal({ open: false, file: null, loading: false, error: '', result: null });
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setImportModal(p => ({ ...p, loading: false, error: `批量创建失败：${err instanceof Error ? err.message : String(err)}` }));
    }
  };

  return (
    <div>
      {canWrite && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <form className="form" onSubmit={onSubmitRequirement} style={{ flex: 1 }}>
            <input name="title" placeholder="需求标题" required />
            <select name="priority" defaultValue="medium"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
            <input name="description" placeholder="需求描述" required />
            <button className="btn" type="submit">新增需求</button>
          </form>
          <button
            className="btn"
            type="button"
            style={{ padding: '8px 16px', background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
            onClick={() => {
              if (!selectedProjectId) return alert('请先在顶部选择项目！');
              setImportModal({ open: true, file: null, loading: false, error: '', result: null });
            }}
          >
            📄 智能导入
          </button>
        </div>
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

      {/* 智能导入向导弹窗 */}
      {importModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 800, maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0 }}>📄 AI 智能导入需求</h3>

            <div style={{ padding: '20px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                支持上传 Excel、Word、PDF 或 TXT 格式的文件，AI 将自动分析文件内容并提取为标准需求列表。
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.doc,.docx,.pdf,.txt,.md"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImportModal(p => ({ ...p, file, result: null, error: '' }));
                    e.target.value = '';
                  }}
                />
                <button className="btn" type="button" onClick={() => fileInputRef.current?.click()}>
                  选择文件
                </button>
                <span style={{ fontSize: 13, flex: 1, color: importModal.file ? 'var(--text)' : 'var(--text-muted)' }}>
                  {importModal.file ? importModal.file.name : '未选择任何文件'}
                </span>
                <button
                  className="btn"
                  type="button"
                  style={{ borderColor: '#b44dff', color: '#b44dff' }}
                  disabled={!importModal.file || importModal.loading}
                  onClick={() => void handleImportUpload()}
                >
                  {importModal.loading && !importModal.result ? '⏳ AI 解析中...' : '🪄 立即识别'}
                </button>
              </div>
              {importModal.error && (
                <div style={{ color: '#ff8080', fontSize: 13, marginTop: 10, padding: 8, background: 'rgba(255,80,80,0.1)', borderRadius: 4 }}>
                  ⚠️ {importModal.error}
                </div>
              )}
            </div>

            {importModal.result && (
              <div style={{ flex: 1, overflow: 'auto', padding: '20px 0' }}>
                <div style={{ marginBottom: 10, fontSize: 13, color: '#00ff88' }}>
                  ✅ 成功识别到 {importModal.result.length} 条需求，请检查或修改确认：
                </div>
                <table className="table" style={{ background: 'var(--color-bg-base)' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>需求标题</th>
                      <th style={{ width: '50%' }}>需求描述</th>
                      <th style={{ width: '15%' }}>优先级</th>
                      <th style={{ width: '10%' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importModal.result.map((req, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            value={req.title}
                            onChange={(e) => {
                              const newList = [...importModal.result!];
                              newList[idx].title = e.target.value;
                              setImportModal(p => ({ ...p, result: newList }));
                            }}
                            style={{ width: '100%', padding: '4px 8px', background: 'transparent', border: 'none', color: 'inherit' }}
                          />
                        </td>
                        <td>
                          <textarea
                            value={req.description}
                            rows={2}
                            onChange={(e) => {
                              const newList = [...importModal.result!];
                              newList[idx].description = e.target.value;
                              setImportModal(p => ({ ...p, result: newList }));
                            }}
                            style={{ width: '100%', padding: '4px 8px', background: 'transparent', border: 'none', color: 'inherit', resize: 'vertical' }}
                          />
                        </td>
                        <td>
                          <select
                            value={req.priority}
                            onChange={(e) => {
                              const newList = [...importModal.result!];
                              newList[idx].priority = e.target.value;
                              setImportModal(p => ({ ...p, result: newList }));
                            }}
                            style={{ width: '100%', padding: '4px 8px', background: 'transparent', border: 'none', color: 'inherit' }}
                          >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                          </select>
                        </td>
                        <td>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => {
                              const newList = [...importModal.result!];
                              newList.splice(idx, 1);
                              setImportModal(p => ({ ...p, result: newList }));
                            }}
                          >
                            移除
                          </button>
                        </td>
                      </tr>
                    ))}
                    {importModal.result.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>没有需求数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 'auto', paddingTop: 20 }}>
              <button
                className="btn"
                type="button"
                onClick={() => setImportModal({ open: false, file: null, loading: false, error: '', result: null })}
              >
                取消
              </button>
              {importModal.result && importModal.result.length > 0 && (
                <button
                  className="btn"
                  type="button"
                  style={{ background: '#b44dff', color: '#fff', borderColor: '#b44dff' }}
                  disabled={importModal.loading}
                  onClick={() => void handleConfirmImport()}
                >
                  {importModal.loading ? '导入中...' : `确认导入 (${importModal.result.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
