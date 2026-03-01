import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiPost, API_BASE, TOKEN_KEY } from '../api/client';
import { comparePrdVersions, createPrdDocument, deletePrdVersion, listPrdDocuments, getPrdVersions, uploadPrdVersion, deletePrdDocument } from '../api/prd';
import type { Requirement, RequirementChange } from '../types';
import type { PrdCompareResult, PrdDocument, PrdVersion } from '../types';
import usePersistentBoolean from '../hooks/usePersistentBoolean';
import ThemedSelect from '../components/ui/ThemedSelect';

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
  onMarkRequirementChanged: (req: Requirement, input: { description: string; reason: string; version: string }) => void;
  onShowRequirementChanges: (req: Requirement) => Promise<void> | void;
  onCloseRequirementChanges: () => void;
  onDeleteRequirement: (req: Requirement) => void;
  onDeleteSelectedRequirements: () => void;
  onToggleRequirementSelection: (id: number, checked: boolean) => void;
  onSelectAllRequirements: (ids: number[], checked: boolean) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
  requirementChanges: RequirementChange[];
  selectedRequirementForChanges: Requirement | null;
  selectedProjectId?: number | null;
  selectedProjectName?: string;
  selectedProjectAlias?: string;
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
  onCloseRequirementChanges,
  onDeleteRequirement,
  onDeleteSelectedRequirements,
  onToggleRequirementSelection,
  onSelectAllRequirements,
  onInlineKeyDown,
  requirementChanges,
  selectedRequirementForChanges,
  selectedProjectId,
  selectedProjectName,
  selectedProjectAlias,
  onImportSuccess
}: Props) {
  const [changeDrawer, setChangeDrawer] = useState<{ open: boolean; req: Requirement | null }>({ open: false, req: null });
  const [changeForm, setChangeForm] = useState({ description: '', reason: '', version: '' });
  const [changeFilters, setChangeFilters] = useState({ keyword: '', author: '', version: '' });
  const [changeFiltersOpen, setChangeFiltersOpen] = usePersistentBoolean('ui:requirements:changeFiltersOpen', true);
  const [compactTable, setCompactTable] = usePersistentBoolean('ui:requirements:compactTable', false);
  const [changeHistoryDrawer, setChangeHistoryDrawer] = useState<{ open: boolean; req: Requirement | null; loading: boolean }>({
    open: false,
    req: null,
    loading: false
  });
  const [actionMenuRowId, setActionMenuRowId] = useState<number | null>(null);

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
  const visibleChangeRows = useMemo(() => {
    if (!changeHistoryDrawer.req) return [];
    if (selectedRequirementForChanges?.id !== changeHistoryDrawer.req.id) return [];
    return filteredChanges;
  }, [changeHistoryDrawer.req, selectedRequirementForChanges, filteredChanges]);
  const requirementMetrics = useMemo(() => {
    const total = requirements.length;
    const highPriority = requirements.filter((item) => item.priority === 'high').length;
    const inReview = requirements.filter((item) => item.status === 'in_review').length;
    const changed = requirements.filter((item) => item.changeCount > 0).length;
    return { total, highPriority, inReview, changed };
  }, [requirements]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.req-action-menu')) {
        setActionMenuRowId(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  // 需求导入状态
  type ParsedReq = { title: string; description: string; priority: string };
  const [importModal, setImportModal] = useState<{ open: boolean; file: File | null; loading: boolean; error: string; result: ParsedReq[] | null }>({
    open: false, file: null, loading: false, error: '', result: null
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prdDocs, setPrdDocs] = useState<PrdDocument[]>([]);
  const [prdVersions, setPrdVersions] = useState<PrdVersion[]>([]);
  const [selectedPrdId, setSelectedPrdId] = useState<number | null>(null);
  const [prdTitleDraft, setPrdTitleDraft] = useState('PRD');
  const [prdUpload, setPrdUpload] = useState<{ file: File | null; versionLabel: string; loading: boolean; error: string }>({
    file: null, versionLabel: '', loading: false, error: ''
  });
  const [comparePick, setComparePick] = useState<{ leftId: number | null; rightId: number | null }>({ leftId: null, rightId: null });
  const [compareResult, setCompareResult] = useState<PrdCompareResult | null>(null);
  const prdFileInputRef = useRef<HTMLInputElement>(null);

  async function refreshPrdDocuments(projectId: number) {
    const docs = await listPrdDocuments(projectId);
    setPrdDocs(docs);
    if (docs.length > 0) {
      setSelectedPrdId((prev) => prev ?? docs[0].id);
    } else {
      setSelectedPrdId(null);
      setPrdVersions([]);
      setCompareResult(null);
      setComparePick({ leftId: null, rightId: null });
    }
  }

  async function refreshPrdVersions(documentId: number) {
    const versions = await getPrdVersions(documentId);
    setPrdVersions(versions);
    setCompareResult(null);
    setComparePick({ leftId: null, rightId: null });
  }

  useEffect(() => {
    if (!selectedProjectId) return;
    void refreshPrdDocuments(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedPrdId) return;
    void refreshPrdVersions(selectedPrdId);
  }, [selectedPrdId]);

  async function handleCreatePrd() {
    if (!selectedProjectId || !prdTitleDraft.trim()) return;
    const doc = await createPrdDocument(selectedProjectId, prdTitleDraft.trim());
    setPrdDocs((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
    setSelectedPrdId(doc.id);
    void refreshPrdDocuments(selectedProjectId);
  }

  async function handleUploadPrd() {
    if (!selectedPrdId || !prdUpload.file) return;
    setPrdUpload((p) => ({ ...p, loading: true, error: '' }));
    try {
      await uploadPrdVersion(selectedPrdId, prdUpload.file, prdUpload.versionLabel.trim() || undefined);
      await refreshPrdVersions(selectedPrdId);
      setPrdUpload({ file: null, versionLabel: '', loading: false, error: '' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setPrdUpload((p) => ({ ...p, loading: false, error: detail }));
    }
  }

  async function handleComparePrd() {
    if (!comparePick.leftId || !comparePick.rightId) return;
    const result = await comparePrdVersions(comparePick.leftId, comparePick.rightId);
    setCompareResult(result);
  }

  async function handleDeletePrdVersion(versionId: number) {
    if (!selectedPrdId) return;
    const target = prdVersions.find((v) => v.id === versionId);
    const label = target?.versionLabel || target?.fileName || String(versionId);
    if (!confirm(`确定删除 PRD 版本「${label}」？此操作不可恢复。`)) return;
    await deletePrdVersion(selectedPrdId, versionId);
    await refreshPrdVersions(selectedPrdId);
  }

  async function handleDeletePrdDocument() {
    if (!selectedPrdId) return;
    const doc = prdDocs.find(d => d.id === selectedPrdId);
    if (!confirm(`确定删除 PRD 库「${doc?.title || selectedPrdId}」及其包含的所有版本吗？此操作不可逆。`)) return;
    await deletePrdDocument(selectedPrdId);
    setSelectedPrdId(null);
    await refreshPrdDocuments(selectedProjectId!);
  }

  function buildCompareMarkdown(result: PrdCompareResult) {
    const leftLabel = result.leftVersion.versionLabel || result.leftVersion.fileName;
    const rightLabel = result.rightVersion.versionLabel || result.rightVersion.fileName;
    const lines = [
      '# PRD 版本对比',
      '',
      `- 旧版本: ${leftLabel}`,
      `- 新版本: ${rightLabel}`,
      `- 摘要: ${result.summary}`,
      '',
      '## 变更明细'
    ];

    result.blocks.forEach((block) => {
      if (block.type === 'added') {
        lines.push(`- 新增: ${block.text || ''}`);
      } else if (block.type === 'removed') {
        lines.push(`- 删除: ${block.text || ''}`);
      } else if (block.type === 'same') {
        lines.push(`- 未变: ${block.text || ''}`);
      } else if (block.type === 'changed' && block.tokens) {
        const oldText = block.tokens.filter((t) => t.type !== 'added').map((t) => t.text).join('');
        const newText = block.tokens.filter((t) => t.type !== 'removed').map((t) => t.text).join('');
        lines.push(`- 修改:\n  - 旧: ${oldText}\n  - 新: ${newText}`);
      }
    });
    return lines.join('\n');
  }

  function downloadText(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleImportUpload = async () => {
    if (!importModal.file) return;
    setImportModal(p => ({ ...p, loading: true, error: '', result: null }));
    try {
      const formData = new FormData();
      formData.append('file', importModal.file);

      const res = await fetch(`${API_BASE}/ai/requirements/import`, {
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
      for (const req of importModal.result) {
        await apiPost('/requirements', {
          projectId: selectedProjectId,
          title: req.title,
          description: req.description,
          priority: req.priority
        });
      }
      setImportModal({ open: false, file: null, loading: false, error: '', result: null });
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setImportModal(p => ({ ...p, loading: false, error: `批量创建失败：${err instanceof Error ? err.message : String(err)}` }));
    }
  };

  return (
    <div>
      <section className="metrics-grid">
        <article className="metric-card">
          <p className="metric-label">需求总数</p>
          <p className="metric-value">{requirementMetrics.total}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">高优先级</p>
          <p className="metric-value warning">{requirementMetrics.highPriority}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">评审中</p>
          <p className="metric-value">{requirementMetrics.inReview}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">有变更记录</p>
          <p className="metric-value">{requirementMetrics.changed}</p>
        </article>
      </section>

      {canWrite && (
        <div className="card compact-card req-create-card">
          <div className="section-title-row">
            <h3>新增与导入</h3>
            <span className="muted">支持手动新增和 AI 智能导入</span>
          </div>
          <div className="req-create-row">
          <form className="form req-create-form" onSubmit={onSubmitRequirement}>
            <input name="title" placeholder="需求标题" required />
            <ThemedSelect name="priority" defaultValue="medium">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </ThemedSelect>
            <input name="description" placeholder="需求描述" required />
            <button className="btn btn-primary" type="submit">新增需求</button>
          </form>
          <button
            className="btn req-import-btn"
            type="button"
            onClick={() => {
              if (!selectedProjectId) return alert('请先在顶部选择项目！');
              setImportModal({ open: true, file: null, loading: false, error: '', result: null });
            }}
          >
            📄 智能导入
          </button>
        </div>
        </div>
      )}
      <div className="card req-list-card">
        <div className="panel-header">
          <h3 className="req-title">需求列表</h3>
          <div className="panel-actions">
            <span className="muted">共 {requirements.length} 条</span>
            <button className="btn" type="button" onClick={() => setCompactTable((prev) => !prev)}>
              {compactTable ? '标准密度' : '紧凑密度'}
            </button>
            {canWrite && (
              <button className="btn btn-danger" type="button" disabled={selectedRequirementIds.length === 0} onClick={onDeleteSelectedRequirements}>
                批量删除 ({selectedRequirementIds.length})
              </button>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table className={`table requirement-table ${compactTable ? 'table-compact' : ''}`}>
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
                  <th>项目-编号</th><th>标题</th><th className="req-desc-col">描述</th><th>优先级</th><th>状态</th><th>变更次数</th>{canWrite && <th className="operation-head">操作</th>}
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
                  <td>{`${selectedProjectAlias || selectedProjectName || `项目${r.projectId}`}-${r.id}`}</td>
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
                    className={`req-desc-col ${isEditing && requirementEdit.editingField === 'description' ? 'editing' : ''}`.trim()}
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
                    <td className="operation-cell">
                      {isEditing && isDirty ? (
                        <div className="req-inline-actions">
                          <button className="btn" type="button" disabled={!isDirty} onClick={() => onSaveRequirement(r)}>保存</button>
                          <button className="btn" type="button" onClick={requirementEdit.cancel}>取消</button>
                        </div>
                      ) : (
                        <div className="req-action-menu">
                          <button
                            className="btn req-action-trigger"
                            type="button"
                            onClick={() => setActionMenuRowId((prev) => (prev === r.id ? null : r.id))}
                          >
                            操作 <span className="req-action-caret">{actionMenuRowId === r.id ? '▴' : '▾'}</span>
                          </button>
                          {actionMenuRowId === r.id && (
                            <div className="req-action-dropdown">
                              <button className="btn req-action-item" type="button" onClick={() => { setActionMenuRowId(null); onReviewRequirement(r.id, 'approved'); }}>通过</button>
                              <button className="btn req-action-item" type="button" onClick={() => { setActionMenuRowId(null); onReviewRequirement(r.id, 'rejected'); }}>驳回</button>
                              <button className="btn req-action-item" type="button" onClick={() => { setActionMenuRowId(null); void triggerAiReview(r); }}>🤖 AI 评审</button>
                              <button
                                className="btn req-action-item"
                                type="button"
                                onClick={() => {
                                  setActionMenuRowId(null);
                                  setChangeDrawer({ open: true, req: r });
                                  setChangeForm({ description: r.description || '', reason: '', version: `v${r.changeCount + 1}.0` });
                                }}
                              >
                                记变更
                              </button>
                              <button
                                className="btn req-action-item"
                                type="button"
                                onClick={async () => {
                                  setActionMenuRowId(null);
                                  setChangeHistoryDrawer({ open: true, req: r, loading: true });
                                  await Promise.resolve(onShowRequirementChanges(r));
                                  setChangeHistoryDrawer((prev) => ({ ...prev, loading: false }));
                                }}
                              >
                                变更记录
                              </button>
                              <button className="btn req-action-item danger" type="button" onClick={() => { setActionMenuRowId(null); onDeleteRequirement(r); }}>删除</button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

      {changeHistoryDrawer.open && changeHistoryDrawer.req && (
        <div
          className="modal-overlay req-modal-overlay req-action-overlay"
          onClick={() => {
            setChangeHistoryDrawer({ open: false, req: null, loading: false });
            onCloseRequirementChanges();
          }}
        >
          <div className="modal-content req-action-modal req-change-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header req-action-modal-header">
              <div>
                <h3 className="req-title">变更时间线</h3>
                <div className="req-subtitle">
                  {changeHistoryDrawer.req.title}
                </div>
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setChangeHistoryDrawer({ open: false, req: null, loading: false });
                  onCloseRequirementChanges();
                }}
              >
                关闭
              </button>
            </div>
            <div className="drawer-body req-action-modal-body">
              <div className="panel-actions req-drawer-actions">
                <span className="muted">最近 {visibleChangeRows.length} 条</span>
                <button className="btn" type="button" onClick={() => setChangeFiltersOpen((prev) => !prev)}>
                  {changeFiltersOpen ? '收起筛选' : '展开筛选'}
                </button>
              </div>
              {changeFiltersOpen && (
                <div className="filters-grid req-filters-grid">
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
              )}
              {changeHistoryDrawer.loading ? (
                <div className="req-loading">加载中...</div>
              ) : (
                <div className="table-wrap">
                  <table className={`table req-change-table ${compactTable ? 'table-compact' : ''}`}>
                    <colgroup>
                      <col className="req-col-160" />
                      <col className="req-col-90" />
                      <col className="req-col-100" />
                      <col className="req-col-170" />
                      <col />
                    </colgroup>
                    <thead><tr><th className="req-nowrap">时间</th><th className="req-nowrap">版本</th><th className="req-nowrap">变更人</th><th className="req-nowrap">原因</th><th className="req-nowrap">变更字段</th></tr></thead>
                    <tbody>
                      {visibleChangeRows.map((change) => (
                        <tr key={change.id}>
                          <td className="req-vmid">{new Date(change.createdAt).toLocaleString()}</td>
                          <td className="req-vmid">{change.version || '-'}</td>
                          <td className="req-vmid">{change.changedBy || '-'}</td>
                          <td className="req-vmid req-prewrap">{change.reason || '-'}</td>
                          <td className="req-vmid req-prewrap">
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
                        </tr>
                      ))}
                      {visibleChangeRows.length === 0 && (
                        <tr><td colSpan={5} className="req-muted-cell">暂无变更记录</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {changeDrawer.open && changeDrawer.req && (
        <div
          className="modal-overlay req-modal-overlay req-action-overlay"
          onClick={() => setChangeDrawer({ open: false, req: null })}
        >
          <div className="modal-content req-action-modal req-change-modal" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header req-action-modal-header">
              <h3>需求变更</h3>
              <button className="btn" type="button" onClick={() => setChangeDrawer({ open: false, req: null })}>关闭</button>
            </div>
            <div className="drawer-body req-action-modal-body">
              <div className="form req-single-col-form">
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
                  <label>变更后需求描述</label>
                  <textarea
                    rows={5}
                    value={changeForm.description}
                    onChange={(e) => setChangeForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div>
                  <label>变更原因</label>
                  <textarea
                    rows={5}
                    value={changeForm.reason}
                    onChange={(e) => setChangeForm((prev) => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="drawer-footer req-action-modal-footer">
              <button
                className="btn"
                type="button"
                disabled={!changeForm.description.trim()}
                onClick={() => {
                  onMarkRequirementChanged(changeDrawer.req!, {
                    description: changeForm.description.trim(),
                    reason: changeForm.reason,
                    version: changeForm.version
                  });
                  setChangeDrawer({ open: false, req: null });
                }}
              >
                提交变更
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 评审结果抽屉 */}
      {aiReviewDrawer.open && (
        <div
          className="modal-overlay req-modal-overlay req-action-overlay"
          onClick={() => setAiReviewDrawer({ open: false, req: null, loading: false, result: '' })}
        >
          <div className="modal-content req-action-modal req-ai-review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header req-action-modal-header">
              <div>
                <h3 className="req-title">🤖 AI 需求评审</h3>
                {aiReviewDrawer.req && (
                  <div className="req-subtitle">
                    {aiReviewDrawer.req.title}
                  </div>
                )}
              </div>
              <button className="btn" type="button" onClick={() => setAiReviewDrawer({ open: false, req: null, loading: false, result: '' })}>关闭</button>
            </div>
            <div className="drawer-body req-action-modal-body">
              {aiReviewDrawer.loading ? (
                <div className="req-loading">
                  <div className="req-loading-icon">🤖</div>
                  <div>AI 正在评审需求质量，请稍候...</div>
                </div>
              ) : (
                <div className="markdown-body req-ai-review-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiReviewDrawer.result || '暂无评审结果'}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 智能导入向导弹窗 */}
      {importModal.open && (
        <div className="modal-overlay req-modal-overlay">
          <div
            className="modal-content req-import-modal"
          >
            <h3 className="req-import-title">📄 AI 智能导入需求</h3>

            <div className="req-import-upload">
              <div className="req-import-hint">
                支持上传 Excel、Word、PDF 或 TXT 格式的文件，AI 将自动分析文件内容并提取为标准需求列表。
              </div>
              <div className="req-import-row">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.doc,.docx,.pdf,.txt,.md"
                  className="req-hidden-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImportModal(p => ({ ...p, file, result: null, error: '' }));
                    e.target.value = '';
                  }}
                />
                <button className="btn" type="button" onClick={() => fileInputRef.current?.click()}>
                  选择文件
                </button>
                <span className={`req-import-file ${importModal.file ? 'has-file' : ''}`}>
                  {importModal.file ? importModal.file.name : '未选择任何文件'}
                </span>
                <button
                  className="btn req-import-parse-btn"
                  type="button"
                  disabled={!importModal.file || importModal.loading}
                  onClick={() => void handleImportUpload()}
                >
                  {importModal.loading && !importModal.result ? '⏳ AI 解析中...' : '🪄 立即识别'}
                </button>
              </div>
              {importModal.error && (
                <div className="req-import-error">
                  ⚠️ {importModal.error}
                </div>
              )}
            </div>

            {importModal.result && (
              <div className="req-import-result">
                <div className="req-import-success">
                  ✅ 成功识别到 {importModal.result.length} 条需求，请检查或修改确认：
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="req-col-p25">需求标题</th>
                      <th className="req-col-p50">需求描述</th>
                      <th className="req-col-p15">优先级</th>
                      <th className="req-col-p10">操作</th>
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
                            className="req-import-cell-input"
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
                            className="req-import-cell-input req-import-cell-textarea"
                          />
                        </td>
                        <td>
                          <ThemedSelect
                            value={req.priority}
                            onChange={(e) => {
                              const newList = [...importModal.result!];
                              newList[idx].priority = e.target.value;
                              setImportModal(p => ({ ...p, result: newList }));
                            }}
                            className="req-import-cell-input"
                          >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                          </ThemedSelect>
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
                        <td colSpan={4} className="req-import-empty">没有需求数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="req-import-footer">
              <button
                className="btn"
                type="button"
                onClick={() => setImportModal({ open: false, file: null, loading: false, error: '', result: null })}
              >
                取消
              </button>
              {importModal.result && importModal.result.length > 0 && (
                <button
                  className="btn btn-primary"
                  type="button"
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

      <section className="panel prd-panel">
        <div className="panel-header">
          <h3>PRD 版本库</h3>
        </div>
        {!selectedProjectId && (
          <p className="muted">请选择项目后再管理 PRD 版本。</p>
        )}
        {selectedProjectId && (
          <>
            <div className="row">
              <label>PRD：</label>
              <ThemedSelect
                value={selectedPrdId == null ? '' : String(selectedPrdId)}
                onChange={(e) => setSelectedPrdId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">请选择 PRD</option>
                {prdDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.title}</option>
                ))}
              </ThemedSelect>
              <input
                type="text"
                placeholder="新 PRD 名称"
                value={prdTitleDraft}
                onChange={(e) => setPrdTitleDraft(e.target.value)}
              />
              <button className="btn prd-btn-strong" type="button" onClick={() => void handleCreatePrd()}>
                新建 PRD
              </button>
              {selectedPrdId && (
                <button
                  className="btn prd-btn-danger"
                  type="button"
                  onClick={() => void handleDeletePrdDocument()}
                >
                  删除库
                </button>
              )}
            </div>

            <div className="row">
              <input
                ref={prdFileInputRef}
                type="file"
                accept=".docx,.pdf"
                className="req-hidden-input"
                onChange={(e) => setPrdUpload((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
              />
              <button
                className="btn prd-btn"
                type="button"
                onClick={() => prdFileInputRef.current?.click()}
              >
                选择文件
              </button>
              <span className="muted req-minw-160">
                {prdUpload.file ? prdUpload.file.name : '未选择任何文件'}
              </span>
              <input
                type="text"
                placeholder="版本号（可选，如 V1.2）"
                value={prdUpload.versionLabel}
                onChange={(e) => setPrdUpload((p) => ({ ...p, versionLabel: e.target.value }))}
              />
              <button
                className="btn prd-btn-strong"
                type="button"
                disabled={!selectedPrdId || !prdUpload.file || prdUpload.loading}
                onClick={() => void handleUploadPrd()}
              >
                {prdUpload.loading ? '上传中...' : '上传版本'}
              </button>
              {prdUpload.error && <span className="warn">上传失败：{prdUpload.error}</span>}
            </div>

            <div className="row">
              <label>对比：</label>
              <ThemedSelect
                value={comparePick.leftId == null ? '' : String(comparePick.leftId)}
                onChange={(e) => setComparePick((p) => ({ ...p, leftId: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">选择旧版本</option>
                {prdVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.versionLabel || v.fileName} ({new Date(v.createdAt).toLocaleString()})
                  </option>
                ))}
              </ThemedSelect>
              <ThemedSelect
                value={comparePick.rightId == null ? '' : String(comparePick.rightId)}
                onChange={(e) => setComparePick((p) => ({ ...p, rightId: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">选择新版本</option>
                {prdVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.versionLabel || v.fileName} ({new Date(v.createdAt).toLocaleString()})
                  </option>
                ))}
              </ThemedSelect>
              <button className="btn prd-btn-strong" type="button" disabled={!comparePick.leftId || !comparePick.rightId} onClick={() => void handleComparePrd()}>
                开始对比
              </button>
              {compareResult && (
                <button
                  className="btn prd-btn"
                  type="button"
                  onClick={() => downloadText('prd-compare.md', buildCompareMarkdown(compareResult))}
                >
                  下载摘要
                </button>
              )}
            </div>

            <div className="card req-mt-12">
              <h3>版本列表</h3>
              <table className="table">
                <thead><tr><th>版本</th><th>文件</th><th>上传时间</th><th>操作</th></tr></thead>
                <tbody>
                  {prdVersions.map((v) => (
                    <tr key={v.id}>
                      <td>{v.versionLabel || '-'}</td>
                      <td>{v.fileName}</td>
                      <td>{new Date(v.createdAt).toLocaleString()}</td>
                      <td>
                        <button className="btn prd-btn-danger" type="button" onClick={() => void handleDeletePrdVersion(v.id)}>删除</button>
                      </td>
                    </tr>
                  ))}
                  {prdVersions.length === 0 && (
                    <tr><td colSpan={4} className="muted">暂无 PRD 版本</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {compareResult && (
              <div className="prd-compare">
                <p className="muted">{compareResult.summary}</p>
                <div className="diff-list">
                  {compareResult.blocks.map((block, idx) => (
                    <div key={`${block.type}-${idx}`} className={`diff-block diff-${block.type}`}>
                      <span className="diff-tag">{block.type === 'added' ? '新增' : block.type === 'removed' ? '删除' : block.type === 'changed' ? '修改' : '未变'}</span>
                      {block.type === 'changed' && block.tokens ? (
                        <div className="diff-inline">
                          {block.tokens.map((token, tokenIdx) => (
                            <span key={`${token.type}-${tokenIdx}`} className={`diff-word diff-word-${token.type}`}>
                              {token.text}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <pre>{block.text}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
