import type { FormEvent, KeyboardEvent } from 'react';
import type { ScheduleData } from '../types';

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
  schedule: ScheduleData | null;
  riskText: string;
  onSubmitTask: (e: FormEvent<HTMLFormElement>) => void;
  onSubmitMilestone: (e: FormEvent<HTMLFormElement>) => void;
  taskEdit: InlineEditState<ScheduleData['tasks'][number], number>;
  milestoneEdit: InlineEditState<ScheduleData['milestones'][number], number>;
  onSaveTask: (task: ScheduleData['tasks'][number]) => void;
  onSaveMilestone: (milestone: ScheduleData['milestones'][number]) => void;
  onDeleteTask: (task: ScheduleData['tasks'][number]) => void;
  onDeleteMilestone: (milestone: ScheduleData['milestones'][number]) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
};

export default function ScheduleView({
  canWrite,
  schedule,
  riskText,
  onSubmitTask,
  onSubmitMilestone,
  taskEdit,
  milestoneEdit,
  onSaveTask,
  onSaveMilestone,
  onDeleteTask,
  onDeleteMilestone,
  onInlineKeyDown
}: Props) {
  return (
    <div>
      {canWrite && (
        <>
          <form className="form" onSubmit={onSubmitTask}>
            <input name="title" placeholder="任务标题" required />
            <input name="assignee" placeholder="负责人" required />
            <select name="status" defaultValue="todo"><option value="todo">todo</option><option value="in_progress">in_progress</option><option value="blocked">blocked</option><option value="done">done</option></select>
            <input name="plannedStart" type="date" required />
            <input name="plannedEnd" type="date" required />
            <button className="btn" type="submit">新增任务</button>
          </form>
          <form className="form" onSubmit={onSubmitMilestone} style={{ marginTop: 10 }}>
            <input name="name" placeholder="里程碑名称" required />
            <input name="plannedDate" type="date" required />
            <button className="btn" type="submit">新增里程碑</button>
          </form>
        </>
      )}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>风险等级: {riskText}</h3>
        <table className="table">
          <thead><tr><th>任务</th><th>负责人</th><th>状态</th><th>计划开始</th><th>计划结束</th>{canWrite && <th>操作</th>}</tr></thead>
          <tbody>
            {schedule?.tasks.map((t) => {
              const isEditing = taskEdit.editingId === t.id;
              const rowDraft = isEditing ? (taskEdit.draft ?? t) : t;
              const isDirty = isEditing && taskEdit.hasDirty(t);
              return (
                <tr key={t.id} className={isEditing ? 'editing-row' : ''}>
                  <td
                    className={isEditing && taskEdit.editingField === 'title' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && taskEdit.startEdit(t, 'title')}
                  >
                    {isEditing && taskEdit.editingField === 'title' ? (
                      <input
                        data-task-edit={`${t.id}-title`}
                        value={rowDraft.title ?? ''}
                        onChange={(e) => taskEdit.updateDraft('title', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveTask(t), taskEdit.cancel)}
                        onBlur={() => taskEdit.finalize(t)}
                      />
                    ) : (
                      rowDraft.title
                    )}
                  </td>
                  <td
                    className={isEditing && taskEdit.editingField === 'assignee' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && taskEdit.startEdit(t, 'assignee')}
                  >
                    {isEditing && taskEdit.editingField === 'assignee' ? (
                      <input
                        data-task-edit={`${t.id}-assignee`}
                        value={rowDraft.assignee ?? ''}
                        onChange={(e) => taskEdit.updateDraft('assignee', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveTask(t), taskEdit.cancel)}
                        onBlur={() => taskEdit.finalize(t)}
                      />
                    ) : (
                      rowDraft.assignee
                    )}
                  </td>
                  <td
                    className={isEditing && taskEdit.editingField === 'status' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && taskEdit.startEdit(t, 'status')}
                  >
                    {isEditing && taskEdit.editingField === 'status' ? (
                      <select
                        data-task-edit={`${t.id}-status`}
                        value={rowDraft.status ?? 'todo'}
                        onChange={(e) => taskEdit.updateDraft('status', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveTask(t), taskEdit.cancel)}
                        onBlur={() => taskEdit.finalize(t)}
                      >
                        {['todo', 'in_progress', 'blocked', 'done'].map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      rowDraft.status
                    )}
                  </td>
                  <td
                    className={isEditing && taskEdit.editingField === 'plannedStart' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && taskEdit.startEdit(t, 'plannedStart')}
                  >
                    {isEditing && taskEdit.editingField === 'plannedStart' ? (
                      <input
                        data-task-edit={`${t.id}-plannedStart`}
                        type="date"
                        value={rowDraft.plannedStart ?? ''}
                        onChange={(e) => taskEdit.updateDraft('plannedStart', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveTask(t), taskEdit.cancel)}
                        onBlur={() => taskEdit.finalize(t)}
                      />
                    ) : (
                      rowDraft.plannedStart
                    )}
                  </td>
                  <td
                    className={isEditing && taskEdit.editingField === 'plannedEnd' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && taskEdit.startEdit(t, 'plannedEnd')}
                  >
                    {isEditing && taskEdit.editingField === 'plannedEnd' ? (
                      <input
                        data-task-edit={`${t.id}-plannedEnd`}
                        type="date"
                        value={rowDraft.plannedEnd ?? ''}
                        onChange={(e) => taskEdit.updateDraft('plannedEnd', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveTask(t), taskEdit.cancel)}
                        onBlur={() => taskEdit.finalize(t)}
                      />
                    ) : (
                      rowDraft.plannedEnd
                    )}
                  </td>
                  {canWrite && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      {isEditing && isDirty ? (
                        <>
                          <button className="btn" type="button" disabled={!isDirty} onClick={() => onSaveTask(t)}>保存</button>
                          <button className="btn" type="button" onClick={taskEdit.cancel}>取消</button>
                        </>
                      ) : (
                        <button className="btn" type="button" onClick={() => onDeleteTask(t)}>删除</button>
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
        <h3>里程碑</h3>
        <table className="table">
          <thead><tr><th>名称</th><th>计划日期</th><th>实际日期</th>{canWrite && <th>操作</th>}</tr></thead>
          <tbody>
            {schedule?.milestones.map((m) => {
              const isEditing = milestoneEdit.editingId === m.id;
              const rowDraft = isEditing ? (milestoneEdit.draft ?? m) : m;
              const isDirty = isEditing && milestoneEdit.hasDirty(m);
              return (
                <tr key={m.id} className={isEditing ? 'editing-row' : ''}>
                  <td
                    className={isEditing && milestoneEdit.editingField === 'name' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && milestoneEdit.startEdit(m, 'name')}
                  >
                    {isEditing && milestoneEdit.editingField === 'name' ? (
                      <input
                        data-milestone-edit={`${m.id}-name`}
                        value={rowDraft.name ?? ''}
                        onChange={(e) => milestoneEdit.updateDraft('name', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveMilestone(m), milestoneEdit.cancel)}
                        onBlur={() => milestoneEdit.finalize(m)}
                      />
                    ) : (
                      rowDraft.name
                    )}
                  </td>
                  <td
                    className={isEditing && milestoneEdit.editingField === 'plannedDate' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && milestoneEdit.startEdit(m, 'plannedDate')}
                  >
                    {isEditing && milestoneEdit.editingField === 'plannedDate' ? (
                      <input
                        data-milestone-edit={`${m.id}-plannedDate`}
                        type="date"
                        value={rowDraft.plannedDate ?? ''}
                        onChange={(e) => milestoneEdit.updateDraft('plannedDate', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveMilestone(m), milestoneEdit.cancel)}
                        onBlur={() => milestoneEdit.finalize(m)}
                      />
                    ) : (
                      rowDraft.plannedDate
                    )}
                  </td>
                  <td
                    className={isEditing && milestoneEdit.editingField === 'actualDate' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && milestoneEdit.startEdit(m, 'actualDate')}
                  >
                    {isEditing && milestoneEdit.editingField === 'actualDate' ? (
                      <input
                        data-milestone-edit={`${m.id}-actualDate`}
                        type="date"
                        value={rowDraft.actualDate ?? ''}
                        onChange={(e) => milestoneEdit.updateDraft('actualDate', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveMilestone(m), milestoneEdit.cancel)}
                        onBlur={() => milestoneEdit.finalize(m)}
                      />
                    ) : (
                      rowDraft.actualDate || '-'
                    )}
                  </td>
                  {canWrite && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      {isEditing && isDirty ? (
                        <>
                          <button className="btn" type="button" disabled={!isDirty} onClick={() => onSaveMilestone(m)}>保存</button>
                          <button className="btn" type="button" onClick={milestoneEdit.cancel}>取消</button>
                        </>
                      ) : (
                        <button className="btn" type="button" onClick={() => onDeleteMilestone(m)}>删除</button>
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
