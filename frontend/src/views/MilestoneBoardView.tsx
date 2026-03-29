import { useEffect, useMemo, useState } from 'react';
import type { MilestoneBoardItem as BoardItem, ProjectItem } from '../types';
import AutocompleteOwner from '../components/ui/AutocompleteOwner';
import ThemedSelect from '../components/ui/ThemedSelect';
import {
  addMilestoneDeliverable,
  createMilestoneBoardItem,
  deleteMilestoneBoardItem,
  deleteMilestoneDeliverable,
  importMilestoneBoardLocal,
  listMilestoneBoardItems,
  updateMilestoneBoardItem,
  updateMilestoneDeliverable
} from '../api/milestoneBoard';

type MilestoneStatus = 'upcoming' | 'in_progress' | 'completed';
type MilestoneRisk = 'low' | 'medium' | 'high';

type DeliverableFormRow = {
  rowId: string;
  deliverableId?: number;
  content: string;
  done: boolean;
};

type Props = {
  projects: ProjectItem[];
  feishuUserNames: string[];
  selectedProjectId: number | null;
  onSelectProject: (id: number | null) => void;
  canWrite: boolean;
};

type LegacyMilestoneItem = {
  id: string;
  title: string;
  owner: string;
  due: string;
  status: MilestoneStatus;
  risk: MilestoneRisk;
  progress: number;
};

type LegacyStore = {
  configs?: Record<string, { owners?: string[]; milestones?: LegacyMilestoneItem[] }>;
};

const LEGACY_STORE_KEY = 'milestone-multi-project-v2';
const MIGRATION_MARKER_KEY = 'milestone-board-migrated-v1';

const statuses: Record<MilestoneStatus, string> = {
  upcoming: '待开始',
  in_progress: '进行中',
  completed: '已完成'
};

const riskText: Record<MilestoneRisk, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险'
};

function todayDateStr(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function parseDateValue(value: string): number | null {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0));
  return d.getTime();
}

function calcNowLinePositionCalcString(nodes: string[], todayStr: string, gapPx: number): string | null {
  if (nodes.length === 0) return null;
  const N = nodes.length;
  if (N === 1) return '50%';
  const todayTs = parseDateValue(todayStr);
  if (todayTs === null) return '50%';
  let r = 0;
  const tFirst = parseDateValue(nodes[0]);
  const tLast = parseDateValue(nodes[N - 1]);
  if (tFirst === null || tLast === null) return '50%';

  if (todayTs <= tFirst) {
    const t2 = parseDateValue(nodes[1]);
    if (t2 && t2 > tFirst) r = 0 - (tFirst - todayTs) / (t2 - tFirst);
  } else if (todayTs >= tLast) {
    const t1 = parseDateValue(nodes[N - 2]);
    if (t1 && tLast > t1) r = (N - 1) + (todayTs - tLast) / (tLast - t1);
    else r = N - 1;
  } else {
    for (let i = 0; i < N - 1; i++) {
      const t1 = parseDateValue(nodes[i]);
      const t2 = parseDateValue(nodes[i + 1]);
      if (t1 !== null && t2 !== null && todayTs >= t1 && todayTs <= t2) {
        r = t2 === t1 ? i : i + (todayTs - t1) / (t2 - t1);
        break;
      }
    }
  }
  r = Math.max(-0.4, Math.min(N - 1 + 0.4, r));
  return `calc(${r + 0.5} * (100% - ${(N - 1) * gapPx}px) / ${N} + ${r * gapPx}px)`;
}

function makeDeliverableRow(partial?: Partial<DeliverableFormRow>): DeliverableFormRow {
  return {
    rowId: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    deliverableId: partial?.deliverableId,
    content: partial?.content ?? '',
    done: partial?.done ?? false
  };
}

function normalizeDeliverableRows(rows: DeliverableFormRow[]) {
  return rows
    .map((row) => ({ ...row, content: row.content.trim() }))
    .filter((row) => row.content.length > 0);
}

function readLegacyStore(): LegacyStore {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LegacyStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default function MilestoneBoardView({ projects, feishuUserNames, selectedProjectId, onSelectProject, canWrite }: Props) {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    owner: '',
    due: '',
    status: 'upcoming' as MilestoneStatus,
    risk: 'low' as MilestoneRisk,
    progress: 0,
    deliverables: [makeDeliverableRow()]
  });

  const currentProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const owners = useMemo(() => {
    return Array.from(new Set(items.map((m) => m.owner))).filter(Boolean);
  }, [items]);

  const ownerOptions = useMemo(() => {
    return Array.from(new Set([...feishuUserNames, ...owners])).filter(Boolean);
  }, [feishuUserNames, owners]);

  const visibleMilestones = useMemo(() => {
    if (ownerFilter === 'all') return items;
    return items.filter((m) => m.owner === ownerFilter);
  }, [items, ownerFilter]);

  const laneMap = useMemo(() => {
    const lanes: Record<MilestoneStatus, BoardItem[]> = { upcoming: [], in_progress: [], completed: [] };
    visibleMilestones.forEach((m) => lanes[m.status].push(m));
    return lanes;
  }, [visibleMilestones]);

  const timelineNodes = useMemo(() => {
    return visibleMilestones.slice().sort((a, b) => a.due.localeCompare(b.due));
  }, [visibleMilestones]);
  const timelineGapPx = timelineNodes.length > 12 ? 3 : timelineNodes.length > 8 ? 5 : 8;
  const todayDue = todayDateStr();
  const nowLineLeftCalc = useMemo(
    () => calcNowLinePositionCalcString(timelineNodes.map(n => n.due), todayDue, timelineGapPx),
    [timelineNodes, todayDue, timelineGapPx]
  );

  const stats = useMemo(() => {
    const total = visibleMilestones.length;
    const highRisk = visibleMilestones.filter((m) => m.risk === 'high').length;
    const avgProgress = total ? Math.round(visibleMilestones.reduce((sum, m) => sum + m.progress, 0) / total) : 0;
    const inProgress = visibleMilestones.filter((m) => m.status === 'in_progress').length;
    return { total, highRisk, avgProgress, inProgress };
  }, [visibleMilestones]);

  async function loadItems(projectId: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await listMilestoneBoardItems(projectId);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载里程碑看板失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projects.length === 0) return;
    if (!selectedProjectId || !projects.some((p) => p.id === selectedProjectId)) {
      onSelectProject(projects[0].id);
    }
  }, [projects, selectedProjectId, onSelectProject]);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadItems(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!canWrite) return;
    if (projects.length === 0) return;
    if (window.localStorage.getItem(MIGRATION_MARKER_KEY) === 'done') return;

    const legacy = readLegacyStore();
    const configs = legacy.configs || {};
    const entries = Object.entries(configs);
    if (entries.length === 0) {
      window.localStorage.setItem(MIGRATION_MARKER_KEY, 'done');
      return;
    }

    let cancelled = false;

    const migrate = async () => {
      let successCount = 0;
      try {
        for (const [projectKey, config] of entries) {
          if (cancelled) return;
          const projectId = Number(projectKey);
          if (!Number.isFinite(projectId) || projectId <= 0) continue;
          const legacyItems = (config?.milestones || []).map((m) => ({
            title: String(m.title || '').trim(),
            owner: String(m.owner || '').trim(),
            due: String(m.due || '').trim(),
            status: m.status || 'upcoming',
            risk: m.risk || 'low',
            progress: Number(m.progress) || 0,
            deliverables: [] as Array<{ content: string; done?: boolean }>
          })).filter((m) => m.title && m.owner && m.due);

          if (legacyItems.length === 0) continue;
          await importMilestoneBoardLocal(projectId, {
            migrationToken: `legacy-v1-${projectId}`,
            items: legacyItems
          });
          successCount += 1;
        }

        if (cancelled) return;
        window.localStorage.setItem(MIGRATION_MARKER_KEY, 'done');
        if (successCount > 0) {
          setMigrationHint(`已完成本地里程碑迁移（${successCount} 个项目）。`);
          if (selectedProjectId) {
            await loadItems(selectedProjectId);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setMigrationHint(`本地里程碑迁移未完成：${err instanceof Error ? err.message : '未知错误'}`);
      }
    };

    void migrate();

    return () => {
      cancelled = true;
    };
  }, [canWrite, projects, selectedProjectId]);

  function resetMilestoneForm() {
    setEditingId(null);
    setMilestoneForm({
      title: '',
      owner: '',
      due: '',
      status: 'upcoming',
      risk: 'low',
      progress: 0,
      deliverables: [makeDeliverableRow()]
    });
  }

  function fillMilestoneForm(item: BoardItem) {
    setEditingId(item.id);
    setMilestoneForm({
      title: item.title,
      owner: item.owner,
      due: item.due,
      status: item.status,
      risk: item.risk,
      progress: item.progress,
      deliverables: item.deliverables.length > 0
        ? item.deliverables.map((d) => makeDeliverableRow({ deliverableId: d.id, content: d.content, done: d.done }))
        : [makeDeliverableRow()]
    });
  }

  async function saveMilestone() {
    if (!currentProject || !canWrite) return;

    const title = milestoneForm.title.trim();
    const owner = milestoneForm.owner.trim();
    const due = milestoneForm.due.trim();
    if (!title || !owner || !due) return;

    const payload = {
      title,
      owner,
      due,
      status: milestoneForm.status,
      risk: milestoneForm.risk,
      progress: Math.max(0, Math.min(100, Number(milestoneForm.progress) || 0))
    };

    const deliverables = normalizeDeliverableRows(milestoneForm.deliverables);

    try {
      setError(null);
      if (!editingId) {
        await createMilestoneBoardItem(currentProject.id, {
          ...payload,
          deliverables: deliverables.map((d) => ({ content: d.content, done: d.done }))
        });
      } else {
        const existing = items.find((item) => item.id === editingId);
        await updateMilestoneBoardItem(editingId, payload);

        if (existing) {
          const currentIds = new Set(deliverables.filter((d) => d.deliverableId).map((d) => Number(d.deliverableId)));
          const deletes = existing.deliverables
            .filter((d) => !currentIds.has(d.id))
            .map((d) => deleteMilestoneDeliverable(d.id));

          const updates = deliverables
            .filter((d) => d.deliverableId)
            .map((row) => {
              const source = existing.deliverables.find((d) => d.id === row.deliverableId);
              if (!source) return Promise.resolve();
              if (source.content === row.content && source.done === row.done) return Promise.resolve();
              return updateMilestoneDeliverable(row.deliverableId!, { content: row.content, done: row.done });
            });

          const creates = deliverables
            .filter((d) => !d.deliverableId)
            .map((row) => addMilestoneDeliverable(editingId, row.content));

          await Promise.all([...deletes, ...updates, ...creates]);
        }
      }

      resetMilestoneForm();
      await loadItems(currentProject.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存里程碑失败');
    }
  }

  async function moveStatus(item: BoardItem, direction: 'next' | 'prev') {
    if (!canWrite || !currentProject) return;
    const next = (() => {
      if (direction === 'next') {
        if (item.status === 'upcoming') return { status: 'in_progress' as MilestoneStatus, progress: Math.max(item.progress, 20) };
        if (item.status === 'in_progress') return { status: 'completed' as MilestoneStatus, progress: 100 };
        return { status: item.status, progress: item.progress };
      }
      if (item.status === 'completed') return { status: 'in_progress' as MilestoneStatus, progress: Math.min(item.progress, 95) };
      if (item.status === 'in_progress') return { status: 'upcoming' as MilestoneStatus, progress: Math.min(item.progress, 19) };
      return { status: item.status, progress: item.progress };
    })();

    try {
      await updateMilestoneBoardItem(item.id, next);
      await loadItems(currentProject.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '推进状态失败');
    }
  }

  async function removeMilestone(id: number) {
    if (!canWrite || !currentProject) return;
    try {
      await deleteMilestoneBoardItem(id);
      if (editingId === id) {
        resetMilestoneForm();
      }
      await loadItems(currentProject.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除里程碑失败');
    }
  }

  async function toggleDeliverableDone(itemId: number, deliverableId: number, done: boolean) {
    if (!canWrite) return;
    const previous = items;
    setItems((prev) => prev.map((item) => (item.id !== itemId ? item : {
      ...item,
      deliverables: item.deliverables.map((d) => (d.id === deliverableId ? { ...d, done } : d))
    })));

    try {
      await updateMilestoneDeliverable(deliverableId, { done });
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : '更新交付物状态失败');
    }
  }

  if (projects.length === 0) {
    return <div className="card">当前无系统项目，请先在项目管理中创建项目。</div>;
  }

  if (!currentProject) {
    return <div className="card">正在加载项目...</div>;
  }

  return (
    <div className="milestone-page">
      <div className="card">
        <h3>多项目里程碑配置与看板</h3>
        <p className="muted">已切换为后端持久化存储，里程碑看板与排期里程碑数据独立。当前日期：{todayDateStr()}</p>
        {migrationHint && <p className="muted">{migrationHint}</p>}
      </div>

      <div className="milestone-page">
        <div className="card">
          <div className="section-title-row">
            <h3>{currentProject.name} · 里程碑看板</h3>
            <span className="muted">项目ID #{currentProject.id}</span>
          </div>
          <div className="metrics-grid milestone-metrics">
            <article className="metric-card"><p className="metric-label">里程碑总数</p><p className="metric-value">{stats.total}</p></article>
            <article className="metric-card"><p className="metric-label">高风险</p><p className="metric-value danger">{stats.highRisk}</p></article>
            <article className="metric-card"><p className="metric-label">平均进度</p><p className="metric-value">{stats.avgProgress}%</p></article>
            <article className="metric-card"><p className="metric-label">进行中</p><p className="metric-value warning">{stats.inProgress}</p></article>
          </div>
        </div>

        <div className="card">
          <div className="section-title-row">
            <h3>里程碑配置</h3>
            {editingId && canWrite && <button className="btn btn-small" type="button" onClick={resetMilestoneForm}>取消编辑</button>}
          </div>
          <div className="form milestone-form-grid">
            <input
              value={milestoneForm.title}
              placeholder="里程碑名称"
              onChange={(e) => setMilestoneForm((prev) => ({ ...prev, title: e.target.value }))}
              disabled={!canWrite}
            />
              <AutocompleteOwner
                value={milestoneForm.owner}
                onChange={(v) => setMilestoneForm((prev) => ({ ...prev, owner: v }))}
                options={ownerOptions}
                placeholder="输入或选择负责人"
                disabled={ownerOptions.length === 0 || !canWrite}
              />
            <input
              type="date"
              value={milestoneForm.due}
              onChange={(e) => setMilestoneForm((prev) => ({ ...prev, due: e.target.value }))}
              disabled={!canWrite}
            />
            <ThemedSelect
              value={milestoneForm.status}
              onChange={(e) => setMilestoneForm((prev) => ({ ...prev, status: e.target.value as MilestoneStatus }))}
              disabled={!canWrite}
            >
              <option value="upcoming">待开始</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
            </ThemedSelect>
            <ThemedSelect
              value={milestoneForm.risk}
              onChange={(e) => setMilestoneForm((prev) => ({ ...prev, risk: e.target.value as MilestoneRisk }))}
              disabled={!canWrite}
            >
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
            </ThemedSelect>
            <input
              type="number"
              min={0}
              max={100}
              value={milestoneForm.progress}
              onChange={(e) => setMilestoneForm((prev) => ({ ...prev, progress: Number(e.target.value) || 0 }))}
              disabled={!canWrite}
            />
            <button className="btn btn-primary" type="button" onClick={() => void saveMilestone()} disabled={!canWrite}>
              {editingId ? '保存' : '新增'}
            </button>
          </div>

          <div className="milestone-deliverables-editor">
            <div className="section-title-row">
              <h3>交付物</h3>
              <button
                className="btn btn-small"
                type="button"
                onClick={() => setMilestoneForm((prev) => ({ ...prev, deliverables: [...prev.deliverables, makeDeliverableRow()] }))}
                disabled={!canWrite}
              >
                + 添加交付物
              </button>
            </div>
            <div className="milestone-deliverables-editor-list">
              {milestoneForm.deliverables.map((row, idx) => (
                <div key={row.rowId} className="milestone-deliverable-editor-row">
                  <input
                    value={row.content}
                    placeholder={`交付物 ${idx + 1}`}
                    onChange={(e) => setMilestoneForm((prev) => ({
                      ...prev,
                      deliverables: prev.deliverables.map((d) => (d.rowId === row.rowId ? { ...d, content: e.target.value } : d))
                    }))}
                    disabled={!canWrite}
                  />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={row.done}
                      onChange={(e) => setMilestoneForm((prev) => ({
                        ...prev,
                        deliverables: prev.deliverables.map((d) => (d.rowId === row.rowId ? { ...d, done: e.target.checked } : d))
                      }))}
                      disabled={!canWrite}
                    />
                    完成
                  </label>
                  <button
                    className="btn btn-small btn-danger"
                    type="button"
                    onClick={() => setMilestoneForm((prev) => ({
                      ...prev,
                      deliverables: prev.deliverables.length <= 1
                        ? [makeDeliverableRow()]
                        : prev.deliverables.filter((d) => d.rowId !== row.rowId)
                    }))}
                    disabled={!canWrite}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>

          {ownerOptions.length === 0 && (
            <p className="muted milestone-owner-empty">暂无可选负责人，请先在“飞书成员”维护人员名册。</p>
          )}
          {!canWrite && (
            <p className="muted milestone-owner-empty">当前角色为只读，仅可查看看板和交付物状态。</p>
          )}
        </div>

        <div className="card">
          <div className="section-title-row">
            <h3>当前项目时间线</h3>
            <span className="milestone-today-chip">当前日期：{todayDateStr()}</span>
          </div>
          <div className="milestone-timeline-scroll">
            <div className="milestone-timeline-shell">
              <div className="milestone-timeline-track" />
              <div
                className="milestone-timeline-grid"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, timelineNodes.length)}, minmax(0, 1fr))`,
                  gap: timelineGapPx
                }}
              >
                {nowLineLeftCalc && (
                  <span
                    className="milestone-timeline-now-line-node"
                    style={{ left: nowLineLeftCalc }}
                  />
                )}
                {timelineNodes.map((m) => {
                  const isDense = timelineNodes.length > 10;
                  const dateFont = timelineNodes.length > 12 ? 13 : 16;
                  const titleFont = timelineNodes.length > 12 ? 12 : isDense ? 13 : 14;
                  const dotColor = m.status === 'completed'
                    ? 'var(--color-success)'
                    : m.status === 'in_progress'
                      ? 'var(--color-primary)'
                      : 'var(--color-border-strong)';
                  return (
                    <div key={`timeline-${m.id}`} className="milestone-timeline-node">
                      <span
                        className="milestone-timeline-dot-shell"
                        style={{ width: isDense ? 22 : 26, height: isDense ? 22 : 26 }}
                      >
                        <span
                          className="milestone-timeline-dot-core"
                          style={{
                            width: isDense ? 11 : 14,
                            height: isDense ? 11 : 14,
                            background: dotColor
                          }}
                        />
                      </span>
                      <div className="milestone-timeline-date" style={{ fontSize: dateFont }}>{m.due}</div>
                      <div
                        className="milestone-timeline-title"
                        style={{ fontSize: titleFont, WebkitLineClamp: timelineNodes.length > 12 ? 2 : 3 }}
                      >
                        {m.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {timelineNodes.length === 0 && <p className="muted">暂无时间线节点</p>}
        </div>

        <div className="card">
          <div className="section-title-row">
            <h3>看板</h3>
            <div className="panel-actions">
              <button className={`btn btn-small ${ownerFilter === 'all' ? 'active' : ''}`} type="button" onClick={() => setOwnerFilter('all')}>全部负责人</button>
              {owners.map((owner) => (
                <button key={owner} className={`btn btn-small ${ownerFilter === owner ? 'active' : ''}`} type="button" onClick={() => setOwnerFilter(owner)}>
                  {owner}
                </button>
              ))}
            </div>
          </div>

          <div className="milestone-lane-grid">
            {(['upcoming', 'in_progress', 'completed'] as MilestoneStatus[]).map((lane) => (
              <section key={lane} className="card milestone-lane">
                <div className="section-title-row">
                  <h3>{statuses[lane]}</h3>
                  <span className="muted">{laneMap[lane].length} 项</span>
                </div>
                <div className="milestone-lane-list">
                  {laneMap[lane].map((m) => (
                    <article key={m.id} className="card milestone-item">
                      <div className="section-title-row">
                        <span className="muted">{m.owner}</span>
                        <span className={`badge ${m.risk === 'high' ? 'danger' : m.risk === 'medium' ? 'warning' : 'success'}`}>{riskText[m.risk]}</span>
                      </div>
                      <strong>{m.title}</strong>
                      <div className="section-title-row">
                        <span className="muted">截止 {m.due}</span>
                        <span className="muted">{m.progress}%</span>
                      </div>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, m.progress))}%` }} /></div>

                      <div className="milestone-deliverables">
                        {m.deliverables.map((d) => (
                          <div key={d.id} className="milestone-deliverable-item">
                            <label className={`checkbox-label ${d.done ? 'milestone-deliverable-done' : ''}`}>
                              <input
                                type="checkbox"
                                checked={d.done}
                                onChange={(e) => void toggleDeliverableDone(m.id, d.id, e.target.checked)}
                                disabled={!canWrite}
                              />
                              <span>{d.content}</span>
                            </label>
                          </div>
                        ))}
                        {m.deliverables.length === 0 && <span className="muted">暂无交付物</span>}
                      </div>

                      <div className="milestone-item-actions">
                        <button className="btn btn-small" type="button" onClick={() => fillMilestoneForm(m)} disabled={!canWrite}>编辑</button>
                        <button className="btn btn-small" type="button" onClick={() => void moveStatus(m, 'prev')} disabled={!canWrite}>回退</button>
                        <button className="btn btn-small" type="button" onClick={() => void moveStatus(m, 'next')} disabled={!canWrite}>推进</button>
                        <button className="btn btn-small btn-danger" type="button" onClick={() => void removeMilestone(m.id)} disabled={!canWrite}>删除</button>
                      </div>
                    </article>
                  ))}
                  {laneMap[lane].length === 0 && <span className="muted">暂无里程碑</span>}
                </div>
              </section>
            ))}
          </div>
        </div>

        {loading && <div className="card"><p className="muted">里程碑看板加载中...</p></div>}
        {error && <div className="card"><p className="danger">{error}</p></div>}
      </div>
    </div>
  );
}
