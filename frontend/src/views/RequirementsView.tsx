import type { FormEvent, KeyboardEvent } from 'react';
import type { Requirement } from '../types';

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
  onSubmitRequirement: (e: FormEvent<HTMLFormElement>) => void;
  requirementEdit: InlineEditState<Requirement, number>;
  onSaveRequirement: (req: Requirement) => void;
  onReviewRequirement: (id: number, decision: 'approved' | 'rejected') => void;
  onMarkRequirementChanged: (req: Requirement) => void;
  onDeleteRequirement: (req: Requirement) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
};

export default function RequirementsView({
  canWrite,
  requirements,
  onSubmitRequirement,
  requirementEdit,
  onSaveRequirement,
  onReviewRequirement,
  onMarkRequirementChanged,
  onDeleteRequirement,
  onInlineKeyDown
}: Props) {
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
        <table className="table">
          <thead><tr><th>ID</th><th>标题</th><th>描述</th><th>优先级</th><th>状态</th><th>变更次数</th>{canWrite && <th>操作</th>}</tr></thead>
          <tbody>
            {requirements.map((r) => {
              const isEditing = requirementEdit.editingId === r.id;
              const rowDraft = isEditing ? (requirementEdit.draft ?? r) : r;
              const isDirty = isEditing && requirementEdit.hasDirty(r);
              return (
                <tr key={r.id} className={isEditing ? 'editing-row' : ''}>
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
                          <button className="btn" type="button" onClick={() => onMarkRequirementChanged(r)}>记变更</button>
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
    </div>
  );
}
