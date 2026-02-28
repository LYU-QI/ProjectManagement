import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { FeishuFormState, FeishuDependency } from '../types';
import usePersistentBoolean from '../hooks/usePersistentBoolean';

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
  scheduleDependencies: FeishuDependency[];
  scheduleDependenciesError: string;
  riskText: string;
  onSubmitTask: (e: FormEvent<HTMLFormElement>) => void;
  onSubmitMilestone: (e: FormEvent<HTMLFormElement>) => void;
  scheduleEdit: InlineEditState<ScheduleRow, string>;
  onSaveSchedule: (row: ScheduleRow) => void;
  onDeleteSchedule: (row: ScheduleRow) => void;
  onAddDependency: (input: { taskRecordId: string; dependsOnRecordId: string; type: 'FS' | 'SS' | 'FF' }) => void;
  onRemoveDependency: (id: number) => void;
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

function formatAssignee(value: string) {
  if (!value) return '-';
  const cleaned = value
    .replace(/ou_[a-zA-Z0-9]+/g, '')
    .replace(/[()（）\[\]]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+[,-]\s*$/, '')
    .trim();
  return cleaned || '-';
}

export default function ScheduleView({
  canWrite,
  tasks,
  milestones,
  scheduleLoading,
  scheduleError,
  scheduleDependencies,
  scheduleDependenciesError,
  riskText,
  onSubmitTask,
  onSubmitMilestone,
  scheduleEdit,
  onSaveSchedule,
  onDeleteSchedule,
  onAddDependency,
  onRemoveDependency,
  onInlineKeyDown
}: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'gantt' | 'calendar'>('list');
  const [compactTable, setCompactTable] = usePersistentBoolean('ui:schedule:compactTable', false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [dependencyForm, setDependencyForm] = useState({ taskRecordId: '', dependsOnRecordId: '', type: 'FS' as 'FS' | 'SS' | 'FF' });
  const ganttWrapperRef = useRef<HTMLDivElement | null>(null);
  const [depPaths, setDepPaths] = useState<Array<{ id: number; d: string; critical?: boolean }>>([]);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  const dependencyMap = useMemo(() => {
    const map = new Map<string, FeishuDependency[]>();
    for (const dep of scheduleDependencies) {
      const list = map.get(dep.taskRecordId) ?? [];
      list.push(dep);
      map.set(dep.taskRecordId, list);
    }
    return map;
  }, [scheduleDependencies]);

  const taskNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      map.set(task.recordId, task.任务名称 || task.任务ID || task.recordId);
    }
    return map;
  }, [tasks]);

  const criticalPath = useMemo(() => {
    if (tasks.length === 0 || scheduleDependencies.length === 0) {
      return { ids: new Set<string>(), chain: [] as string[], duration: 0 };
    }
    const taskIds = new Set(tasks.map((task) => task.recordId));
    const deps = scheduleDependencies.filter(
      (dep) => dep.type === 'FS' && taskIds.has(dep.taskRecordId) && taskIds.has(dep.dependsOnRecordId)
    );

    const incoming = new Map<string, number>();
    const edges = new Map<string, string[]>();
    for (const task of tasks) {
      incoming.set(task.recordId, 0);
      edges.set(task.recordId, []);
    }
    for (const dep of deps) {
      const from = dep.dependsOnRecordId;
      const to = dep.taskRecordId;
      edges.get(from)?.push(to);
      incoming.set(to, (incoming.get(to) ?? 0) + 1);
    }

    const duration = new Map<string, number>();
    for (const task of tasks) {
      const start = toDate(task.开始时间);
      const end = toDate(task.截止时间 || task.开始时间);
      if (start && end) {
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
        duration.set(task.recordId, days);
      } else {
        duration.set(task.recordId, 1);
      }
    }

    const queue: string[] = [];
    incoming.forEach((count, id) => {
      if (count === 0) queue.push(id);
    });

    const order: string[] = [];
    while (queue.length) {
      const node = queue.shift()!;
      order.push(node);
      for (const next of edges.get(node) ?? []) {
        incoming.set(next, (incoming.get(next) ?? 1) - 1);
        if ((incoming.get(next) ?? 0) === 0) queue.push(next);
      }
    }

    if (order.length !== tasks.length) {
      return { ids: new Set<string>(), chain: [] as string[], duration: 0 };
    }

    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    for (const id of order) {
      dist.set(id, duration.get(id) ?? 1);
      prev.set(id, null);
    }
    for (const id of order) {
      const base = dist.get(id) ?? 1;
      for (const next of edges.get(id) ?? []) {
        const cand = base + (duration.get(next) ?? 1);
        if (cand > (dist.get(next) ?? 0)) {
          dist.set(next, cand);
          prev.set(next, id);
        }
      }
    }

    let endId: string | null = null;
    let max = 0;
    dist.forEach((value, key) => {
      if (value > max) {
        max = value;
        endId = key;
      }
    });
    const critical = new Set<string>();
    const chain: string[] = [];
    let cursor: string | null = endId;
    while (cursor !== null) {
      critical.add(cursor);
      chain.push(cursor);
      const nextId: string | null = prev.get(cursor) ?? null;
      cursor = nextId;
    }
    chain.reverse();
    return { ids: critical, chain, duration: max };
  }, [tasks, scheduleDependencies]);

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

  useEffect(() => {
    if (viewMode !== 'gantt') return;
    const wrapper = ganttWrapperRef.current;
    if (!wrapper) return;

    let frame = 0;
    const update = () => {
      if (!wrapper) return;
      const wrapperRect = wrapper.getBoundingClientRect();
      const width = wrapper.scrollWidth || wrapperRect.width;
      const height = wrapper.scrollHeight || wrapperRect.height;
      setSvgSize({ width, height });

      const paths: Array<{ id: number; d: string; critical?: boolean }> = [];
      for (const dep of scheduleDependencies) {
        const fromEl = wrapper.querySelector<HTMLElement>(`[data-bar-id="${dep.dependsOnRecordId}"]`);
        const toEl = wrapper.querySelector<HTMLElement>(`[data-bar-id="${dep.taskRecordId}"]`);
        if (!fromEl || !toEl) continue;
        const isCritical = dep.type === 'FS' && criticalPath.ids.has(dep.dependsOnRecordId) && criticalPath.ids.has(dep.taskRecordId);

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const fromStart = fromRect.left - wrapperRect.left;
        const fromEnd = fromRect.right - wrapperRect.left;
        const toStart = toRect.left - wrapperRect.left;
        const toEnd = toRect.right - wrapperRect.left;
        const fromY = (fromRect.top + fromRect.bottom) / 2 - wrapperRect.top;
        const toY = (toRect.top + toRect.bottom) / 2 - wrapperRect.top;

        const fromX = dep.type === 'SS' ? fromStart : fromEnd;
        const toX = dep.type === 'FF' ? toEnd : toStart;
        const dx = toX - fromX;
        const offset = Math.sign(dx || 1) * Math.min(12, Math.abs(dx) / 2);
        const midX = fromX + offset;
        const path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
        paths.push({ id: dep.id, d: path, critical: isCritical });
      }
      setDepPaths(paths);
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    scheduleUpdate();
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(wrapper);
    const onScroll = () => scheduleUpdate();
    wrapper.addEventListener('scroll', onScroll);
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      wrapper.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [viewMode, scheduleDependencies, ganttData, criticalPath]);

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
  const scheduleMetrics = useMemo(() => {
    const taskCount = tasks.length;
    const milestoneCount = milestones.length;
    const dependencyCount = scheduleDependencies.length;
    const blockedCount = tasks.filter((item) => (item.状态 || '').includes('阻塞')).length;
    return { taskCount, milestoneCount, dependencyCount, blockedCount };
  }, [tasks, milestones, scheduleDependencies]);

  return (
    <div>
      <section className="metrics-grid">
        <article className="metric-card">
          <p className="metric-label">任务总数</p>
          <p className="metric-value">{scheduleMetrics.taskCount}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">里程碑</p>
          <p className="metric-value">{scheduleMetrics.milestoneCount}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">依赖关系</p>
          <p className="metric-value">{scheduleMetrics.dependencyCount}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">阻塞任务</p>
          <p className="metric-value warning">{scheduleMetrics.blockedCount}</p>
        </article>
      </section>

      <div className="card compact-card" style={{ marginTop: 12 }}>
        <div className="section-title-row">
          <h3>进度视图</h3>
          <span className="muted">风险等级：{riskText}</span>
        </div>
        <div className="panel-header" style={{ marginBottom: 0 }}>
          <div className="muted">切换不同展示方式查看任务状态</div>
          <div className="panel-actions">
            {viewMode === 'list' && (
              <button className="btn theme-btn" type="button" onClick={() => setCompactTable((prev) => !prev)}>
                {compactTable ? '标准密度' : '紧凑密度'}
              </button>
            )}
            <button className={viewMode === 'list' ? 'btn theme-btn active' : 'btn theme-btn'} type="button" onClick={() => setViewMode('list')}>列表</button>
            <button className={viewMode === 'gantt' ? 'btn theme-btn active' : 'btn theme-btn'} type="button" onClick={() => setViewMode('gantt')}>甘特图</button>
            <button className={viewMode === 'calendar' ? 'btn theme-btn active' : 'btn theme-btn'} type="button" onClick={() => setViewMode('calendar')}>日历</button>
          </div>
        </div>
        {scheduleLoading && <p>Loading...</p>}
        {scheduleError && <p className="warn">{scheduleError}</p>}
      </div>

      {viewMode === 'list' && (
        <>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>进度同步仅展示飞书数据，请在飞书记录模块新增或编辑。</p>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="section-title-row">
              <h3>任务列表</h3>
              <span className="muted">来自飞书记录同步</span>
            </div>
            <div className="table-wrap">
              <table className={`table ${compactTable ? 'table-compact' : ''}`}>
                <thead><tr><th>任务</th><th>负责人</th><th>状态</th><th>计划开始</th><th>计划结束</th><th>进度</th></tr></thead>
                <tbody>
                  {tasks.map((t) => {
                    return (
                      <tr key={t.recordId}>
                        <td>{t.任务名称}</td>
                        <td>{formatAssignee(t.负责人)}</td>
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
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="section-title-row">
              <h3>里程碑</h3>
              <span className="muted">按计划与实际日期追踪</span>
            </div>
            <div className="table-wrap">
              <table className={`table ${compactTable ? 'table-compact' : ''}`}>
                <thead><tr><th>名称</th><th>负责人</th><th>计划日期</th><th>实际日期</th><th>状态</th><th>进度</th></tr></thead>
                <tbody>
                  {milestones.map((m) => {
                    return (
                      <tr key={m.recordId}>
                        <td>{m.任务名称}</td>
                        <td>{formatAssignee(m.负责人)}</td>
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
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="section-title-row">
              <h3>任务依赖（WBS）</h3>
              <span className="muted">支持 FS / SS / FF 关系</span>
            </div>
            {scheduleDependenciesError && <p className="warn">{scheduleDependenciesError}</p>}
            <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end' }}>
              <div>
                <label>任务</label>
                <select
                  value={dependencyForm.taskRecordId}
                  onChange={(e) => setDependencyForm((prev) => ({ ...prev, taskRecordId: e.target.value }))}
                >
                  <option value="">选择任务</option>
                  {tasks.map((task) => (
                    <option key={task.recordId} value={task.recordId}>{task.任务名称 || task.任务ID}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>依赖关系</label>
                <select
                  value={dependencyForm.type}
                  onChange={(e) => setDependencyForm((prev) => ({ ...prev, type: e.target.value as 'FS' | 'SS' | 'FF' }))}
                >
                  <option value="FS">FS 完成→开始</option>
                  <option value="SS">SS 开始→开始</option>
                  <option value="FF">FF 完成→完成</option>
                </select>
              </div>
              <div>
                <label>前置任务</label>
                <select
                  value={dependencyForm.dependsOnRecordId}
                  onChange={(e) => setDependencyForm((prev) => ({ ...prev, dependsOnRecordId: e.target.value }))}
                >
                  <option value="">选择前置任务</option>
                  {tasks.map((task) => (
                    <option key={task.recordId} value={task.recordId}>{task.任务名称 || task.任务ID}</option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  className="btn theme-btn"
                  type="button"
                  disabled={!canWrite || !dependencyForm.taskRecordId || !dependencyForm.dependsOnRecordId}
                  onClick={() => {
                    if (!dependencyForm.taskRecordId || !dependencyForm.dependsOnRecordId) return;
                    onAddDependency({
                      taskRecordId: dependencyForm.taskRecordId,
                      dependsOnRecordId: dependencyForm.dependsOnRecordId,
                      type: dependencyForm.type
                    });
                    setDependencyForm((prev) => ({ ...prev, dependsOnRecordId: '' }));
                  }}
                >
                  新增依赖
                </button>
              </div>
            </div>

            <table className={`table ${compactTable ? 'table-compact' : ''}`} style={{ marginTop: 10 }}>
              <thead><tr><th>任务</th><th>关系</th><th>前置任务</th><th>操作</th></tr></thead>
              <tbody>
                {scheduleDependencies.map((dep) => {
                  const task = tasks.find((item) => item.recordId === dep.taskRecordId);
                  const dependsOn = tasks.find((item) => item.recordId === dep.dependsOnRecordId);
                  const taskLabel = task?.任务名称 || '未命名任务';
                  const dependsOnLabel = dependsOn?.任务名称 || '未命名任务';
                  return (
                    <tr key={dep.id}>
                      <td>{taskLabel}</td>
                      <td>{dep.type}</td>
                      <td>{dependsOnLabel}</td>
                      <td>
                        {canWrite ? (
                          <button className="btn theme-btn-danger" type="button" onClick={() => onRemoveDependency(dep.id)}>删除</button>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
                {scheduleDependencies.length === 0 && (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>暂无任务依赖</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {viewMode === 'gantt' && (
        <div className="card">
          <div className="section-title-row">
            <h3>甘特图</h3>
            <span className="muted">关键路径高亮展示</span>
          </div>
          {ganttData.days.length === 0 ? (
            <p className="warn">暂无可用日期数据，无法生成甘特图。</p>
          ) : (
            <div className="gantt-wrapper" ref={ganttWrapperRef}>
              <svg className="gantt-deps" width={svgSize.width} height={svgSize.height}>
                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-text-muted)" />
                  </marker>
                </defs>
                {depPaths.map((path) => (
                  <path
                    key={path.id}
                    d={path.d}
                    stroke={path.critical ? 'var(--color-warning)' : 'var(--color-text-muted)'}
                    strokeWidth={1}
                    fill="none"
                    markerEnd="url(#arrow)"
                  />
                ))}
              </svg>

              <div className="gantt-chart">
                {criticalPath.chain.length > 0 && (
                  <div className="gantt-summary">
                    关键路径：{criticalPath.chain.map((id) => taskNameMap.get(id) || id).join(' → ')} ｜ 总工期：{criticalPath.duration} 天
                  </div>
                )}
                <div
                  className="gantt-header"
                  style={{ gridTemplateColumns: `220px repeat(${ganttData.days.length}, minmax(24px, 1fr))` }}
                >
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
                  const deps = dependencyMap.get(row.recordId) ?? [];
                  const depLabel = deps.length
                    ? `依赖: ${deps.map((dep) => `${taskNameMap.get(dep.dependsOnRecordId) || dep.dependsOnTaskId || dep.dependsOnRecordId}(${dep.type})`).join(', ')}`
                    : '';
                  const isCritical = criticalPath.ids.has(row.recordId);
                  const endDate = toDate(row.截止时间 || row.开始时间);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const overdue = isCritical && endDate ? endDate.getTime() < today.getTime() : false;
                  return (
                    <div
                      key={row.recordId}
                      className="gantt-row"
                      style={{ gridTemplateColumns: `220px repeat(${ganttData.days.length}, minmax(24px, 1fr))` }}
                    >
                      <div className="gantt-cell gantt-label">
                        <div>{row.任务名称 || row.任务ID}</div>
                        {depLabel && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{depLabel}</div>}
                        {overdue && <div className="gantt-overdue">关键任务已延期</div>}
                      </div>
                      <div
                        className={`gantt-bar ${kind === 'milestone' ? 'gantt-milestone' : ''} ${isCritical ? 'gantt-critical' : ''} ${overdue ? 'gantt-overdue-bar' : ''}`}
                        data-bar-id={row.recordId}
                        style={{ gridColumn: `${startIndex + 2} / ${safeEnd + 3}` }}
                        title={`${row.任务名称 || row.任务ID} (${row.开始时间} → ${row.截止时间 || row.开始时间})`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="card">
          <div className="section-title-row">
            <h3>日历视图</h3>
            <span className="muted">任务与里程碑按日分布</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button className="btn theme-btn" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>上个月</button>
            <strong>{calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月</strong>
            <button className="btn theme-btn" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>下个月</button>
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
