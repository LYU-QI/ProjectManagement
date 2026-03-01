import { useEffect, useMemo, useState } from 'react';
import type { ProjectItem } from '../types';
import ThemedSelect from '../components/ui/ThemedSelect';

type MilestoneStatus = 'upcoming' | 'in_progress' | 'completed';
type MilestoneRisk = 'low' | 'medium' | 'high';

type MilestoneItem = {
  id: string;
  title: string;
  owner: string;
  due: string;
  status: MilestoneStatus;
  risk: MilestoneRisk;
  progress: number;
};

type ProjectMilestoneConfig = {
  owners: string[];
  milestones: MilestoneItem[];
};

type MilestoneStore = {
  configs: Record<string, ProjectMilestoneConfig>;
};

type Props = {
  projects: ProjectItem[];
  feishuUserNames: string[];
  selectedProjectId: number | null;
  onSelectProject: (id: number | null) => void;
};

const STORE_KEY = 'milestone-multi-project-v2';

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

function todayText() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadStore(): MilestoneStore {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { configs: {} };
    const parsed = JSON.parse(raw) as MilestoneStore;
    if (!parsed || typeof parsed !== 'object' || !parsed.configs) return { configs: {} };
    return parsed;
  } catch {
    return { configs: {} };
  }
}

function toProjectKey(projectId: number) {
  return String(projectId);
}

export default function MilestoneBoardView({ projects, feishuUserNames, selectedProjectId, onSelectProject }: Props) {
  const [store, setStore] = useState<MilestoneStore>(() => loadStore());
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    owner: '',
    due: '',
    status: 'upcoming' as MilestoneStatus,
    risk: 'low' as MilestoneRisk,
    progress: 0
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      // ignore storage write errors
    }
  }, [store]);

  useEffect(() => {
    if (projects.length === 0) return;
    if (!selectedProjectId || !projects.some((p) => p.id === selectedProjectId)) {
      onSelectProject(projects[0].id);
    }
  }, [projects, selectedProjectId, onSelectProject]);

  const currentProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const currentConfig = useMemo<ProjectMilestoneConfig>(() => {
    if (!currentProject) return { owners: [], milestones: [] };
    return store.configs[toProjectKey(currentProject.id)] || { owners: [], milestones: [] };
  }, [store, currentProject]);

  const owners = useMemo(() => {
    return Array.from(new Set([...currentConfig.owners, ...currentConfig.milestones.map((m) => m.owner)])).filter(Boolean);
  }, [currentConfig]);

  const ownerOptions = useMemo(() => {
    return Array.from(new Set([...feishuUserNames, ...owners])).filter(Boolean);
  }, [feishuUserNames, owners]);

  const visibleMilestones = useMemo(() => {
    if (ownerFilter === 'all') return currentConfig.milestones;
    return currentConfig.milestones.filter((m) => m.owner === ownerFilter);
  }, [currentConfig, ownerFilter]);

  const laneMap = useMemo(() => {
    const lanes: Record<MilestoneStatus, MilestoneItem[]> = { upcoming: [], in_progress: [], completed: [] };
    visibleMilestones.forEach((m) => lanes[m.status].push(m));
    return lanes;
  }, [visibleMilestones]);

  const timelineNodes = useMemo(() => {
    return visibleMilestones.slice().sort((a, b) => a.due.localeCompare(b.due));
  }, [visibleMilestones]);

  const stats = useMemo(() => {
    const total = visibleMilestones.length;
    const highRisk = visibleMilestones.filter((m) => m.risk === 'high').length;
    const avgProgress = total ? Math.round(visibleMilestones.reduce((sum, m) => sum + m.progress, 0) / total) : 0;
    const inProgress = visibleMilestones.filter((m) => m.status === 'in_progress').length;
    return { total, highRisk, avgProgress, inProgress };
  }, [visibleMilestones]);

  function updateCurrentConfig(mutator: (cfg: ProjectMilestoneConfig) => ProjectMilestoneConfig) {
    if (!currentProject) return;
    const key = toProjectKey(currentProject.id);
    setStore((prev) => {
      const current = prev.configs[key] || { owners: [], milestones: [] };
      return {
        ...prev,
        configs: {
          ...prev.configs,
          [key]: mutator(current)
        }
      };
    });
  }

  function resetMilestoneForm() {
    setEditingId(null);
    setMilestoneForm({
      title: '',
      owner: '',
      due: '',
      status: 'upcoming',
      risk: 'low',
      progress: 0
    });
  }

  function createOrUpdateMilestone() {
    if (!currentProject) return;
    const title = milestoneForm.title.trim();
    const owner = milestoneForm.owner.trim();
    const due = milestoneForm.due.trim();
    if (!title || !owner || !due) return;

    const nextItem: MilestoneItem = {
      id: editingId || `ms-${Date.now().toString(36)}`,
      title,
      owner,
      due,
      status: milestoneForm.status,
      risk: milestoneForm.risk,
      progress: Math.max(0, Math.min(100, Number(milestoneForm.progress) || 0))
    };

    updateCurrentConfig((cfg) => {
      const existingIdx = cfg.milestones.findIndex((m) => m.id === nextItem.id);
      const milestones = existingIdx >= 0
        ? cfg.milestones.map((m, idx) => (idx === existingIdx ? nextItem : m))
        : [...cfg.milestones, nextItem];
      const ownersNext = cfg.owners.includes(owner) ? cfg.owners : [...cfg.owners, owner];
      return { owners: ownersNext, milestones };
    });

    resetMilestoneForm();
  }

  function editMilestone(item: MilestoneItem) {
    setEditingId(item.id);
    setMilestoneForm({
      title: item.title,
      owner: item.owner,
      due: item.due,
      status: item.status,
      risk: item.risk,
      progress: item.progress
    });
  }

  function moveStatus(id: string, direction: 'next' | 'prev') {
    updateCurrentConfig((cfg) => ({
      ...cfg,
      milestones: cfg.milestones.map((m) => {
        if (m.id !== id) return m;
        if (direction === 'next') {
          if (m.status === 'upcoming') return { ...m, status: 'in_progress', progress: Math.max(m.progress, 20) };
          if (m.status === 'in_progress') return { ...m, status: 'completed', progress: 100 };
          return m;
        }
        if (m.status === 'completed') return { ...m, status: 'in_progress', progress: Math.min(m.progress, 95) };
        if (m.status === 'in_progress') return { ...m, status: 'upcoming', progress: Math.min(m.progress, 19) };
        return m;
      })
    }));
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
        <p className="muted">请使用页面上方“目标工作区”切换项目。里程碑配置按项目独立保存（本地）。当前日期：{todayText()}</p>
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
              {editingId && <button className="btn btn-small" type="button" onClick={resetMilestoneForm}>取消编辑</button>}
            </div>
            <div className="form milestone-form-grid">
              <input value={milestoneForm.title} placeholder="里程碑名称" onChange={(e) => setMilestoneForm((prev) => ({ ...prev, title: e.target.value }))} />
              <ThemedSelect
                value={milestoneForm.owner}
                onChange={(e) => setMilestoneForm((prev) => ({ ...prev, owner: e.target.value }))}
                disabled={ownerOptions.length === 0}
              >
                <option value="">选择负责人（飞书成员）</option>
                {ownerOptions.map((owner) => (
                  <option key={`owner-${owner}`} value={owner}>{owner}</option>
                ))}
              </ThemedSelect>
              <input
                type="date"
                value={milestoneForm.due}
                onChange={(e) => setMilestoneForm((prev) => ({ ...prev, due: e.target.value }))}
              />
              <ThemedSelect value={milestoneForm.status} onChange={(e) => setMilestoneForm((prev) => ({ ...prev, status: e.target.value as MilestoneStatus }))}>
                <option value="upcoming">待开始</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
              </ThemedSelect>
              <ThemedSelect value={milestoneForm.risk} onChange={(e) => setMilestoneForm((prev) => ({ ...prev, risk: e.target.value as MilestoneRisk }))}>
                <option value="low">低风险</option>
                <option value="medium">中风险</option>
                <option value="high">高风险</option>
              </ThemedSelect>
              <input type="number" min={0} max={100} value={milestoneForm.progress} onChange={(e) => setMilestoneForm((prev) => ({ ...prev, progress: Number(e.target.value) || 0 }))} />
              <button className="btn btn-primary" type="button" onClick={createOrUpdateMilestone}>{editingId ? '保存' : '新增'}</button>
            </div>
            {ownerOptions.length === 0 && (
              <p className="muted milestone-owner-empty">暂无可选负责人，请先在“飞书成员”维护人员名册。</p>
            )}
          </div>

          <div className="card">
            <div className="section-title-row">
              <h3>当前项目时间线</h3>
              <span className="milestone-today-chip">
                当前日期：{todayText()}
              </span>
            </div>
            <div className="milestone-timeline-scroll">
              <div className="milestone-timeline-shell">
                <div className="milestone-timeline-track" />
                <div
                  className="milestone-timeline-grid"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, timelineNodes.length)}, minmax(0, 1fr))`,
                    gap: timelineNodes.length > 12 ? 3 : timelineNodes.length > 8 ? 5 : 8
                  }}
                >
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
                          style={{
                            width: isDense ? 22 : 26,
                            height: isDense ? 22 : 26,
                          }}
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
                          style={{
                            fontSize: titleFont,
                            WebkitLineClamp: timelineNodes.length > 12 ? 2 : 3,
                          }}
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
                        <div className="milestone-item-actions">
                          <button className="btn btn-small" type="button" onClick={() => editMilestone(m)}>编辑</button>
                          <button className="btn btn-small" type="button" onClick={() => moveStatus(m.id, 'prev')}>回退</button>
                          <button className="btn btn-small" type="button" onClick={() => moveStatus(m.id, 'next')}>推进</button>
                          <button
                            className="btn btn-small btn-danger"
                            type="button"
                            onClick={() => updateCurrentConfig((cfg) => ({ ...cfg, milestones: cfg.milestones.filter((item) => item.id !== m.id) }))}
                          >
                            删除
                          </button>
                        </div>
                      </article>
                    ))}
                    {laneMap[lane].length === 0 && <span className="muted">暂无里程碑</span>}
                  </div>
                </section>
              ))}
            </div>
          </div>
      </div>
    </div>
  );
}
