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
  selectedCostEntryIds: number[];
  onSubmitCost: (e: FormEvent<HTMLFormElement>) => void;
  onSubmitWorklog: (e: FormEvent<HTMLFormElement>) => void;
  costEdit: InlineEditState<CostEntryItem, number>;
  worklogEdit: InlineEditState<Worklog, number>;
  onSaveCost: (entry: CostEntryItem) => void;
  onSaveWorklog: (worklog: Worklog) => void;
  onDeleteCost: (entry: CostEntryItem) => void;
  onDeleteSelectedCostEntries: () => void;
  onToggleCostEntrySelection: (id: number, checked: boolean) => void;
  onSelectAllCostEntries: (ids: number[], checked: boolean) => void;
  onDeleteWorklog: (worklog: Worklog) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
};

export default function CostsView({
  canWrite,
  costSummary,
  costEntries,
  worklogs,
  selectedCostEntryIds,
  onSubmitCost,
  onSubmitWorklog,
  costEdit,
  worklogEdit,
  onSaveCost,
  onSaveWorklog,
  onDeleteCost,
  onDeleteSelectedCostEntries,
  onToggleCostEntrySelection,
  onSelectAllCostEntries,
  onDeleteWorklog,
  onInlineKeyDown
}: Props) {
  const formatCostType = (value: string) => {
    if (value === 'labor') return '人力';
    if (value === 'outsource') return '外包';
    if (value === 'cloud') return '云资源';
    return value;
  };

  return (
    <div>
      {canWrite && (
        <>
          <form className="form" onSubmit={onSubmitCost}>
            <select name="type" defaultValue="labor">
              <option value="labor">人力</option>
              <option value="outsource">外包</option>
              <option value="cloud">云资源</option>
            </select>
            <input name="amount" type="number" step="0.01" placeholder="金额" required />
            <input name="occurredOn" type="date" required />
            <input name="note" placeholder="备注" />
            <button className="btn" type="submit">新增成本</button>
          </form>
          <form className="form" onSubmit={onSubmitWorklog} style={{ marginTop: 10 }}>
            <input name="taskTitle" placeholder="工时任务" required />
            <input name="assigneeName" placeholder="负责人(姓名)" required />
            <input name="weekStart" type="date" required />
            <input name="weekEnd" type="date" required />
            <input name="totalDays" type="number" min="0" step="0.5" placeholder="总人天" required />
            <input name="dailyRate" type="number" step="0.01" placeholder="人天单价" required />
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
        {canWrite && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button className="btn" type="button" disabled={selectedCostEntryIds.length === 0} onClick={onDeleteSelectedCostEntries}>
              批量删除 ({selectedCostEntryIds.length})
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
                    checked={costEntries.length > 0 && selectedCostEntryIds.length === costEntries.length}
                    onChange={(e) => onSelectAllCostEntries(costEntries.map((c) => c.id), e.target.checked)}
                  />
                </th>
              )}
              <th>ID</th><th>类型</th><th>金额</th><th>日期</th><th>备注</th>{canWrite && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {costEntries.map((entry) => {
              const isEditing = costEdit.editingId === entry.id;
              const rowDraft = isEditing ? (costEdit.draft ?? entry) : entry;
              const isDirty = isEditing && costEdit.hasDirty(entry);
              return (
                <tr key={entry.id} className={isEditing ? 'editing-row' : ''}>
                  {canWrite && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedCostEntryIds.includes(entry.id)}
                        onChange={(e) => onToggleCostEntrySelection(entry.id, e.target.checked)}
                      />
                    </td>
                  )}
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
                      formatCostType(String(rowDraft.type))
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
          <thead><tr><th>周期</th><th>任务</th><th>负责人</th><th>人天</th><th>人天单价</th><th>成本</th>{canWrite && <th>操作</th>}</tr></thead>
          <tbody>
            {worklogs.map((w) => {
              const isEditing = worklogEdit.editingId === w.id;
              const rowDraft = isEditing ? (worklogEdit.draft ?? w) : w;
              const isDirty = isEditing && worklogEdit.hasDirty(w);
              const totalDays = Number(rowDraft.totalDays ?? (Number(rowDraft.hours) ? Number(rowDraft.hours) / 8 : 0));
              const hours = Number.isFinite(totalDays) && totalDays > 0 ? totalDays * 8 : Number(rowDraft.hours);
              const hourlyRate = Number(rowDraft.hourlyRate);
              const dailyRate = Number.isFinite(hourlyRate) ? hourlyRate * 8 : Number.NaN;
              const cost = Number.isFinite(hours) && Number.isFinite(hourlyRate) ? (hours * hourlyRate).toFixed(2) : '-';
              return (
                <tr key={w.id} className={isEditing ? 'editing-row' : ''}>
                  <td
                    className={isEditing && (worklogEdit.editingField === 'weekStart' || worklogEdit.editingField === 'weekEnd') ? 'editing' : ''}
                    onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'weekStart')}
                  >
                    {isEditing && (worklogEdit.editingField === 'weekStart' || worklogEdit.editingField === 'weekEnd') ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          data-worklog-edit={`${w.id}-weekStart`}
                          type="date"
                          value={rowDraft.weekStart ?? rowDraft.workedOn ?? ''}
                          onChange={(e) => worklogEdit.updateDraft('weekStart', e.target.value)}
                          onKeyDown={(e) => onInlineKeyDown(e, () => onSaveWorklog(w), worklogEdit.cancel)}
                          onBlur={() => worklogEdit.finalize(w)}
                        />
                        <input
                          data-worklog-edit={`${w.id}-weekEnd`}
                          type="date"
                          value={rowDraft.weekEnd ?? ''}
                          onChange={(e) => worklogEdit.updateDraft('weekEnd', e.target.value)}
                          onKeyDown={(e) => onInlineKeyDown(e, () => onSaveWorklog(w), worklogEdit.cancel)}
                          onBlur={() => worklogEdit.finalize(w)}
                        />
                      </div>
                    ) : (
                      rowDraft.weekStart && rowDraft.weekEnd
                        ? `${rowDraft.weekStart} ~ ${rowDraft.weekEnd}`
                        : rowDraft.workedOn
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
                    className={isEditing && worklogEdit.editingField === 'assigneeName' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'assigneeName')}
                  >
                    {isEditing && worklogEdit.editingField === 'assigneeName' ? (
                      <input
                        data-worklog-edit={`${w.id}-assigneeName`}
                        value={rowDraft.assigneeName ?? ''}
                        onChange={(e) => worklogEdit.updateDraft('assigneeName', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveWorklog(w), worklogEdit.cancel)}
                        onBlur={() => worklogEdit.finalize(w)}
                      />
                    ) : (
                      rowDraft.assigneeName || '-'
                    )}
                  </td>
                  <td
                    className={isEditing && worklogEdit.editingField === 'totalDays' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && worklogEdit.startEdit(w, 'totalDays')}
                  >
                    {isEditing && worklogEdit.editingField === 'totalDays' ? (
                      <input
                        data-worklog-edit={`${w.id}-totalDays`}
                        type="number"
                        step="0.5"
                        value={rowDraft.totalDays ?? ''}
                        onChange={(e) => worklogEdit.updateDraft('totalDays', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveWorklog(w), worklogEdit.cancel)}
                        onBlur={() => worklogEdit.finalize(w)}
                      />
                    ) : (
                      totalDays ? totalDays.toFixed(1) : '-'
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
                        value={Number.isFinite(dailyRate) ? dailyRate : ''}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          const nextHourly = Number.isFinite(value) ? value / 8 : 0;
                          worklogEdit.updateDraft('hourlyRate', String(nextHourly));
                        }}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveWorklog(w), worklogEdit.cancel)}
                        onBlur={() => worklogEdit.finalize(w)}
                      />
                    ) : (
                      Number.isFinite(dailyRate) ? dailyRate.toFixed(2) : '-'
                    )}
                  </td>
                  <td>{cost}</td>
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
