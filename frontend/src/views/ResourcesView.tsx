import { useMemo, useState } from 'react';
import type { Worklog, FeishuFormState, UserItem } from '../types';

type Props = {
  worklogs: Worklog[];
  scheduleTasks: Array<FeishuFormState & { recordId: string }>;
  scheduleLoading: boolean;
  scheduleError: string;
  selectedProjectName: string;
  users: UserItem[];
};

type RangePreset = 'week' | 'month' | 'custom';

type LoadRow = {
  assignee: string;
  taskCount: number;
  activeTasks: string[];
  days: number;
};

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function inRange(date: Date | null, start: Date, end: Date) {
  if (!date) return false;
  return date >= start && date <= end;
}

export default function ResourcesView({
  worklogs,
  scheduleTasks,
  scheduleLoading,
  scheduleError,
  selectedProjectName,
  users
}: Props) {
  const [preset, setPreset] = useState<RangePreset>('week');
  const today = new Date();
  const [customStart, setCustomStart] = useState(() => formatDateInput(startOfWeek(today)));
  const [customEnd, setCustomEnd] = useState(() => formatDateInput(endOfWeek(today)));

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (preset === 'week') {
      return { rangeStart: startOfWeek(today), rangeEnd: endOfWeek(today) };
    }
    if (preset === 'month') {
      return { rangeStart: startOfMonth(today), rangeEnd: endOfMonth(today) };
    }
    const start = parseDate(customStart) ?? startOfWeek(today);
    const end = parseDate(customEnd) ?? endOfWeek(today);
    return { rangeStart: start, rangeEnd: end };
  }, [preset, customStart, customEnd]);

  const loadRows = useMemo<LoadRow[]>(() => {
    const map = new Map<string, LoadRow>();

    for (const task of scheduleTasks) {
      const assignee = task.负责人?.trim() || '未分配';
      const start = parseDate(task.开始时间);
      const end = parseDate(task.截止时间) ?? start;
      if (!start || !end) continue;
      const overlaps = end >= rangeStart && start <= rangeEnd;
      if (!overlaps) continue;

      const row = map.get(assignee) ?? { assignee, taskCount: 0, activeTasks: [], days: 0 };
      row.taskCount += 1;
      row.activeTasks.push(task.任务名称 || task.任务ID || '未命名');
      map.set(assignee, row);
    }

    const userMap = new Map(users.map((user) => [user.id, user.name || user.username]));
    for (const log of worklogs) {
      const assignee = log.assigneeName?.trim()
        || (log.userId ? (userMap.get(log.userId) ?? `用户#${log.userId}`) : '未分配');
      const weekStart = parseDate(log.weekStart ?? '');
      const weekEnd = parseDate(log.weekEnd ?? '') ?? weekStart;
      const overlaps = weekStart && weekEnd ? (weekEnd >= rangeStart && weekStart <= rangeEnd) : false;
      if (!overlaps) continue;
      const row = map.get(assignee) ?? { assignee, taskCount: 0, activeTasks: [], days: 0 };
      if (log.totalDays !== undefined && log.totalDays !== null) {
        row.days += Number(log.totalDays) || 0;
      } else if (Number.isFinite(Number(log.hours))) {
        row.days += Number(log.hours) / 8;
      }
      map.set(assignee, row);
    }

    return Array.from(map.values()).sort((a, b) => b.taskCount - a.taskCount || b.days - a.days);
  }, [scheduleTasks, worklogs, rangeStart, rangeEnd]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3>资源负载</h3>
          <span style={{ color: 'var(--text-muted)' }}>项目: {selectedProjectName}</span>
        </div>
        <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginTop: 10 }}>
          <select value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)}>
            <option value="week">本周</option>
            <option value="month">本月</option>
            <option value="custom">自定义</option>
          </select>
          <input type="date" value={formatDateInput(rangeStart)} disabled={preset !== 'custom'} onChange={(e) => setCustomStart(e.target.value)} />
          <input type="date" value={formatDateInput(rangeEnd)} disabled={preset !== 'custom'} onChange={(e) => setCustomEnd(e.target.value)} />
        </div>
        {scheduleLoading && <p>Loading...</p>}
        {scheduleError && <p className="warn">{scheduleError}</p>}
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>负责人</th><th>任务数</th><th>本期人天</th><th>活跃任务</th></tr></thead>
          <tbody>
            {loadRows.map((row) => (
              <tr key={row.assignee}>
                <td>{row.assignee}</td>
                <td>{row.taskCount}</td>
                <td>{row.days.toFixed(1)}</td>
                <td>{row.activeTasks.length > 0 ? row.activeTasks.join(' / ') : '-'}</td>
              </tr>
            ))}
            {loadRows.length === 0 && (
              <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>暂无匹配数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
