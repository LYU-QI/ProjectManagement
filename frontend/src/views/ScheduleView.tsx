import { useMemo, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { FeishuFormState } from '../types';

type ScheduleRow = FeishuFormState & { recordId: string };

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
  tasks: ScheduleRow[];
  milestones: ScheduleRow[];
  scheduleLoading: boolean;
  scheduleError: string;
  riskText: string;
  onSubmitTask: (e: FormEvent<HTMLFormElement>) => void;
  onSubmitMilestone: (e: FormEvent<HTMLFormElement>) => void;
  scheduleEdit: InlineEditState<ScheduleRow, string>;
  onSaveSchedule: (row: ScheduleRow) => void;
  onDeleteSchedule: (row: ScheduleRow) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
};

function toDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toDateKey(value: string) {
  return value || '';
}

function formatProgress(value: string) {
  if (!value) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  const percent = num <= 1 ? num * 100 : num;
  const rounded = Number.isInteger(percent) ? percent : Number(percent.toFixed(2));
  return `${rounded}%`;
}

export default function ScheduleView({
  canWrite,
  tasks,
  milestones,
  scheduleLoading,
  scheduleError,
  riskText,
  onSubmitTask,
  onSubmitMilestone,
  scheduleEdit,
  onSaveSchedule,
  onDeleteSchedule,
  onInlineKeyDown
}: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'gantt' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const ganttData = useMemo(() => {
    const rows = [
      ...tasks.map((row) => ({ row, kind: 'task' as const })),
      ...milestones.map((row) => ({ row, kind: 'milestone' as const }))
    ];

    const dateRanges = rows
      .map(({ row }) => {
        const start = toDate(row.开始时间);
        const end = toDate(row.截止时间) ?? start;
        return start && end ? { start, end } : null;
      })
      .filter(Boolean) as Array<{ start: Date; end: Date }>;

    if (dateRanges.length === 0) {
      return { days: [] as string[], rows: [] as typeof rows };
    }

    const minStart = dateRanges.reduce((min, item) => (item.start < min ? item.start : min), dateRanges[0].start);
    const maxEnd = dateRanges.reduce((max, item) => (item.end > max ? item.end : max), dateRanges[0].end);

    const days: string[] = [];
    const cursor = new Date(minStart);
    while (cursor <= maxEnd) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    return { days, rows };
  }, [tasks, milestones]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());

    return Array.from({ length: 42 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      return date;
    });
  }, [calendarMonth]);

  const calendarItems = useMemo(() => {
    const items = [...tasks, ...milestones].map((row) => ({
      id: row.recordId,
      name: row.任务名称 || row.任务ID || '未命名',
      date: toDateKey(row.开始时间),
      kind: row.里程碑 === '是' ? '里程碑' : '任务'
    }));

    const grouped: Record<string, Array<{ id: string; name: string; kind: string }>> = {};
    for (const item of items) {
      if (!item.date) continue;
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push({ id: item.id, name: item.name, kind: item.kind });
    }
    return grouped;
  }, [tasks, milestones]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3>进度同步视图</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={viewMode === 'list' ? 'btn active' : 'btn'} type="button" onClick={() => setViewMode('list')}>列表</button>
            <button className={viewMode === 'gantt' ? 'btn active' : 'btn'} type="button" onClick={() => setViewMode('gantt')}>甘特图</button>
            <button className={viewMode === 'calendar' ? 'btn active' : 'btn'} type="button" onClick={() => setViewMode('calendar')}>日历</button>
          </div>
        </div>
        <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>风险等级: {riskText}</p>
        {scheduleLoading && <p>Loading...</p>}
        {scheduleError && <p className="warn">{scheduleError}</p>}
      </div>

      {viewMode === 'list' && (
        <>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>进度同步仅展示飞书数据，请在飞书记录模块新增或编辑。</p>

          <div className="card" style={{ marginTop: 12 }}>
            <h3>任务列表</h3>
            <table className="table">
              <thead><tr><th>任务ID</th><th>任务</th><th>负责人</th><th>状态</th><th>计划开始</th><th>计划结束</th><th>进度</th></tr></thead>
              <tbody>
                {tasks.map((t) => {
                  return (
                    <tr key={t.recordId}>
                      <td>{t.任务ID}</td>
                      <td>{t.任务名称}</td>
                      <td>{t.负责人 || '-'}</td>
                      <td>{t.状态}</td>
                      <td>{t.开始时间}</td>
                      <td>{t.截止时间}</td>
                      <td>{formatProgress(t.进度)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h3>里程碑</h3>
            <table className="table">
              <thead><tr><th>里程碑ID</th><th>名称</th><th>负责人</th><th>计划日期</th><th>实际日期</th><th>状态</th><th>进度</th></tr></thead>
              <tbody>
                {milestones.map((m) => {
                  return (
                    <tr key={m.recordId}>
                      <td>{m.任务ID}</td>
                      <td>{m.任务名称}</td>
                      <td>{m.负责人 || '-'}</td>
                      <td>{m.开始时间}</td>
                      <td>{m.截止时间 || '-'}</td>
                      <td>{m.状态}</td>
                      <td>{formatProgress(m.进度)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {viewMode === 'gantt' && (
        <div className="card">
          {ganttData.days.length === 0 ? (
            <p className="warn">暂无可用日期数据，无法生成甘特图。</p>
          ) : (
            <div className="gantt-chart">
              <div className="gantt-header" style={{ gridTemplateColumns: `220px repeat(${ganttData.days.length}, minmax(24px, 1fr))` }}>
                <div className="gantt-cell gantt-label">任务</div>
                {ganttData.days.map((day) => (
                  <div key={day} className="gantt-cell">{day.slice(5)}</div>
                ))}
              </div>
              {ganttData.rows.map(({ row, kind }) => {
                const startKey = toDateKey(row.开始时间);
                const endKey = toDateKey(row.截止时间 || row.开始时间);
                const startIndex = ganttData.days.indexOf(startKey);
                const endIndex = ganttData.days.indexOf(endKey);
                if (startIndex < 0) return null;
                const safeEnd = endIndex < 0 ? startIndex : endIndex;
                return (
                  <div
                    key={row.recordId}
                    className="gantt-row"
                    style={{ gridTemplateColumns: `220px repeat(${ganttData.days.length}, minmax(24px, 1fr))` }}
                  >
                    <div className="gantt-cell gantt-label">{row.任务名称 || row.任务ID}</div>
                    <div
                      className={`gantt-bar ${kind === 'milestone' ? 'gantt-milestone' : ''}`}
                      style={{ gridColumn: `${startIndex + 2} / ${safeEnd + 3}` }}
                      title={`${row.任务名称 || row.任务ID} (${row.开始时间} → ${row.截止时间 || row.开始时间})`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button className="btn" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>上个月</button>
            <strong>{calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月</strong>
            <button className="btn" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>下个月</button>
          </div>
          <div className="calendar-grid">
            {['日', '一', '二', '三', '四', '五', '六'].map((label) => (
              <div key={label} className="calendar-cell calendar-header">{label}</div>
            ))}
            {calendarDays.map((date) => {
              const dayKey = date.toISOString().slice(0, 10);
              const items = calendarItems[dayKey] || [];
              const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
              return (
                <div key={dayKey} className={`calendar-cell ${isCurrentMonth ? '' : 'calendar-muted'}`}>
                  <div className="calendar-date">{date.getDate()}</div>
                  {items.map((item) => (
                    <div key={item.id} className="calendar-item" title={item.name}>
                      <span className="calendar-tag">{item.kind}</span>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
