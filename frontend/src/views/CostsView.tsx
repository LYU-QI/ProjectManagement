import type { FormEvent, KeyboardEvent } from 'react';
import type { CostEntryItem, CostSummary, Worklog } from '../types';

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
  costSummary: CostSummary | null;
  costEntries: CostEntryItem[];
  worklogs: Worklog[];
  onSubmitCost: (e: FormEvent<HTMLFormElement>) => void;
  onSubmitWorklog: (e: FormEvent<HTMLFormElement>) => void;
  costEdit: InlineEditState<CostEntryItem, number>;
  worklogEdit: InlineEditState<Worklog, number>;
  onSaveCost: (entry: CostEntryItem) => void;
  onSaveWorklog: (worklog: Worklog) => void;
  onDeleteCost: (entry: CostEntryItem) => void;
  onDeleteWorklog: (worklog: Worklog) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
};

export default function CostsView({
  canWrite,
  costSummary,
  costEntries,
  worklogs,
  onSubmitCost,
  onSubmitWorklog,
  costEdit,
  worklogEdit,
  onSaveCost,
  onSaveWorklog,
  onDeleteCost,
  onDeleteWorklog,
  onInlineKeyDown
}: Props) {
  return (
    <div>
      {canWrite && (
        <>
          <form className="form" onSubmit={onSubmitCost}>
            <select name="type" defaultValue="labor"><option value="labor">labor</option><option value="outsource">outsource</option><option value="cloud">cloud</option></select>
            <input name="amount" type="number" step="0.01" placeholder="金额" required />
            <input name="occurredOn" type="date" required />
            <input name="note" placeholder="备注" />
            <button className="btn" type="submit">新增成本</button>
          </form>
          <form className="form" onSubmit={onSubmitWorklog} style={{ marginTop: 10 }}>
            <input name="taskTitle" placeholder="工时任务" required />
            <input name="hours" type="number" step="0.5" placeholder="工时(小时)" required />
            <input name="hourlyRate" type="number" step="0.01" placeholder="时薪" required />
            <input name="workedOn" type="date" required />
            <input name="note" placeholder="备注" />
            <button className="btn" type="submit">新增工时</button>
          </form>
        </>
      )}
      <div className="grid" style={{ marginTop: 12 }}>
        <div className="card"><h3>预算</h3><p>{costSummary?.budget ?? 0}</p></div>
        <div className="card"><h3>实际</h3><p>{costSummary?.actual ?? 0}</p></div>
        <div className="card"><h3>偏差%</h3><p className={costSummary && costSummary.varianceRate > 10 ? 'warn' : ''}>{costSummary?.varianceRate ?? 0}</p></div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>成本条目</h3>
        <table className="table">
          <thead><tr><th>ID</th><th>类型</th><th>金额</th><th>日期</th><th>备注</th>{canWrite && <th>操作</th>}</tr></thead>
          <tbody>
            {costEntries.map((entry) => {
              const isEditing = costEdit.editingId === entry.id;
              const rowDraft = isEditing ? (costEdit.draft ?? entry) : entry;
              const isDirty = isEditing && costEdit.hasDirty(entry);
              return (
                <tr key={entry.id} className={isEditing ? 'editing-row' : ''}>
                  <td>{entry.id}</td>
                  <td
                    className={isEditing && costEdit.editingField === 'type' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && costEdit.startEdit(entry, 'type')}
                  >
                    {isEditing && costEdit.editingField === 'type' ? (
                      <select
                        data-cost-edit={`${entry.id}-type`}
                        value={rowDraft.type ?? 'labor'}
                        onChange={(e) => costEdit.updateDraft('type', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveCost(entry), costEdit.cancel)}
                        onBlur={() => costEdit.finalize(entry)}
                      >
                        {['labor', 'outsource', 'cloud'].map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      rowDraft.type
                    )}
                  </td>
                  <td
                    className={isEditing && costEdit.editingField === 'amount' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && costEdit.startEdit(entry, 'amount')}
                  >
                    {isEditing && costEdit.editingField === 'amount' ? (
                      <input
                        data-cost-edit={`${entry.id}-amount`}
                        type="number"
                        step="0.01"
                        value={rowDraft.amount ?? ''}
                        onChange={(e) => costEdit.updateDraft('amount', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveCost(entry), costEdit.cancel)}
                        onBlur={() => costEdit.finalize(entry)}
                      />
                    ) : (
                      rowDraft.amount
                    )}
                  </td>
                  <td
                    className={isEditing && costEdit.editingField === 'occurredOn' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && costEdit.startEdit(entry, 'occurredOn')}
                  >
                    {isEditing && costEdit.editingField === 'occurredOn' ? (
                      <input
                        data-cost-edit={`${entry.id}-occurredOn`}
                        type="date"
                        value={rowDraft.occurredOn ?? ''}
                        onChange={(e) => costEdit.updateDraft('occurredOn', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveCost(entry), costEdit.cancel)}
                        onBlur={() => costEdit.finalize(entry)}
                      />
                    ) : (
                      rowDraft.occurredOn
                    )}
                  </td>
                  <td
                    className={isEditing && costEdit.editingField === 'note' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && costEdit.startEdit(entry, 'note')}
                  >
                    {isEditing && costEdit.editingField === 'note' ? (
                      <input
                        data-cost-edit={`${entry.id}-note`}
                        value={rowDraft.note ?? ''}
                        onChange={(e) => costEdit.updateDraft('note', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveCost(entry), costEdit.cancel)}
                        onBlur={() => costEdit.finalize(entry)}
                      />
                    ) : (
                      rowDraft.note || '-'
                    )}
                  </td>
                  {canWrite && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      {isEditing && isDirty ? (
                        <>
                          <button className="btn" type="button" disabled={!isDirty} onClick={() => onSaveCost(entry)}>保存</button>
                          <button className="btn" type="button" onClick={costEdit.cancel}>取消</button>
                        </>
                      ) : (
                        <button className="btn" type="button" onClick={() => onDeleteCost(entry)}>删除</button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>工时明细</h3>
        <table className="table">
          <thead><tr><th>日期</th><th>任务</th><th>工时</th><th>时薪</th><th>成本</th><th>备注</th>{canWrite && <th>操作</th>}</tr></thead>
          <tbody>
            {worklogs.map((w) => {
              const isEditing = worklogEdit.editingId === w.id;
              const rowDraft = isEditing ? (worklogEdit.draft ?? w) : w;
              const isDirty = isEditing && worklogEdit.hasDirty(w);
              const hours = Number(rowDraft.hours);
              const hourlyRate = Number(rowDraft.hourlyRate);
              const cost = Number.isFinite(hours) && Number.isFinite(hourlyRate) ? (hours * hourlyRate).toFixed(2) : '-';
              return (
                <tr key={w.id} className={isEditing ? 'editing-row' : ''}>
                  <td
                    className={isEditing && worklogEdit.editingField === 'workedOn' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'workedOn')}
                  >
                    {isEditing && worklogEdit.editingField === 'workedOn' ? (
                      <input
                        data-worklog-edit={`${w.id}-workedOn`}
                        type="date"
                        value={rowDraft.workedOn ?? ''}
                        onChange={(e) => worklogEdit.updateDraft('workedOn', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveWorklog(w), worklogEdit.cancel)}
                        onBlur={() => worklogEdit.finalize(w)}
                      />
                    ) : (
                      rowDraft.workedOn
                    )}
                  </td>
                  <td
                    className={isEditing && worklogEdit.editingField === 'taskTitle' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'taskTitle')}
                  >
                    {isEditing && worklogEdit.editingField === 'taskTitle' ? (
                      <input
                        data-worklog-edit={`${w.id}-taskTitle`}
                        value={rowDraft.taskTitle ?? ''}
                        onChange={(e) => worklogEdit.updateDraft('taskTitle', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveWorklog(w), worklogEdit.cancel)}
                        onBlur={() => worklogEdit.finalize(w)}
                      />
                    ) : (
                      rowDraft.taskTitle || '-'
                    )}
                  </td>
                  <td
                    className={isEditing && worklogEdit.editingField === 'hours' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'hours')}
                  >
                    {isEditing && worklogEdit.editingField === 'hours' ? (
                      <input
                        data-worklog-edit={`${w.id}-hours`}
                        type="number"
                        step="0.5"
                        value={rowDraft.hours ?? ''}
                        onChange={(e) => worklogEdit.updateDraft('hours', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveWorklog(w), worklogEdit.cancel)}
                        onBlur={() => worklogEdit.finalize(w)}
                      />
                    ) : (
                      rowDraft.hours
                    )}
                  </td>
                  <td
                    className={isEditing && worklogEdit.editingField === 'hourlyRate' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'hourlyRate')}
                  >
                    {isEditing && worklogEdit.editingField === 'hourlyRate' ? (
                      <input
                        data-worklog-edit={`${w.id}-hourlyRate`}
                        type="number"
                        step="0.01"
                        value={rowDraft.hourlyRate ?? ''}
                        onChange={(e) => worklogEdit.updateDraft('hourlyRate', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveWorklog(w), worklogEdit.cancel)}
                        onBlur={() => worklogEdit.finalize(w)}
                      />
                    ) : (
                      rowDraft.hourlyRate
                    )}
                  </td>
                  <td>{cost}</td>
                  <td
                    className={isEditing && worklogEdit.editingField === 'note' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'note')}
                  >
                    {isEditing && worklogEdit.editingField === 'note' ? (
                      <input
                        data-worklog-edit={`${w.id}-note`}
                        value={rowDraft.note ?? ''}
                        onChange={(e) => worklogEdit.updateDraft('note', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveWorklog(w), worklogEdit.cancel)}
                        onBlur={() => worklogEdit.finalize(w)}
                      />
                    ) : (
                      rowDraft.note || '-'
                    )}
                  </td>
                  {canWrite && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      {isEditing && isDirty ? (
                        <>
                          <button className="btn" type="button" disabled={!isDirty} onClick={() => onSaveWorklog(w)}>保存</button>
                          <button className="btn" type="button" onClick={worklogEdit.cancel}>取消</button>
                        </>
                      ) : (
                        <button className="btn" type="button" onClick={() => onDeleteWorklog(w)}>删除</button>
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
