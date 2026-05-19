import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ClusterRiskBoardItem,
  ClusterRiskBoardResponse,
  ClusterRiskLight,
  DashboardOverview,
  DeliveryRoadmapItem,
  DeliveryRoadmapResponse,
  ProjectItem
} from '../types';

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

type RoadmapFixedQuarter = {
  key: string;
  label: string;
  year: number;
  quarter: number;
  start: Date;
  end: Date;
};

type Props = {
  canWrite: boolean;
  overview: DashboardOverview | null;
  clusterRiskBoard: ClusterRiskBoardResponse | null;
  onRefreshClusterRiskBoard: () => Promise<void>;
  deliveryRoadmap: DeliveryRoadmapResponse | null;
  onRefreshDeliveryRoadmap: () => Promise<void>;
  projects: ProjectItem[];
  selectedProjectId: number | null;
  selectedProjectIds: number[];
  onToggleProjectSelection: (id: number, checked: boolean) => void;
  onDeleteSelectedProjects: () => void;
  onSubmitProject: (e: FormEvent<HTMLFormElement>) => void;
  onDeleteProject: (project: ProjectItem) => void;
  projectEdit: InlineEditState<ProjectItem, number>;
  onSaveProject: (project: ProjectItem) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
};

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString();
}

function healthTone(score: number): 'good' | 'mid' | 'bad' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'mid';
  return 'bad';
}

function riskToneClass(light: ClusterRiskLight): string {
  if (light === '红灯') return 'red';
  if (light === '黄灯') return 'yellow';
  if (light === '绿灯') return 'green';
  return 'empty';
}

function keyDemoLabel(value: boolean | null): string {
  if (value === true) return '近期演示';
  if (value === false) return '非演示';
  return '待确认';
}

function excerpt(value: string, max = 96): string {
  const text = value?.trim() || '-';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function countFilteredClusterSummary(items: ClusterRiskBoardItem[]) {
  return {
    totalProjects: items.length,
    redCount: items.filter((item) => item.riskLight === '红灯').length,
    yellowCount: items.filter((item) => item.riskLight === '黄灯').length,
    greenCount: items.filter((item) => item.riskLight === '绿灯').length,
    emptyRiskCount: items.filter((item) => item.riskLight === '未填').length,
    keyDemoCount: items.filter((item) => item.hasKeyDemo === true).length,
    dailyRiskHelpCount: items.filter((item) => Boolean(item.dailyRiskHelp.trim())).length,
    highQualityRiskCount: items.filter((item) => item.qualityLevel.includes('高') || item.qualityGap.includes('高风险')).length
  };
}

function roadmapDateLabel(item: DeliveryRoadmapItem): string {
  const date = item.targetDate ? item.targetDate.slice(5).replace('-', '/') : (item.targetQuarter || '未定');
  return item.isTbd ? `${date} (TBD)` : date;
}

function roadmapIconColor(item: DeliveryRoadmapItem, roadmap: DeliveryRoadmapResponse | null): string {
  return roadmap?.legend.find((legend) => legend.iconStyle === item.iconStyle)?.color || '#64748b';
}

function roadmapLaneTone(categoryL1: string): 'main' | 'factory' | 'other' {
  if (categoryL1.includes('主线')) return 'main';
  if (categoryL1.includes('车厂') || categoryL1.includes('交付')) return 'factory';
  return 'other';
}

function quarterStart(year: number, quarter: number): Date {
  return new Date(year, (quarter - 1) * 3, 1);
}

function buildFixedRoadmapQuarters(count = 7): RoadmapFixedQuarter[] {
  const now = new Date();
  const startYear = now.getFullYear();
  const startQuarter = Math.floor(now.getMonth() / 3) + 1;

  return Array.from({ length: count }).map((_, index) => {
    const zeroBasedQuarter = startQuarter - 1 + index;
    const year = startYear + Math.floor(zeroBasedQuarter / 4);
    const quarter = (zeroBasedQuarter % 4) + 1;
    const start = quarterStart(year, quarter);
    const end = quarterStart(year, quarter + 1);
    return {
      key: `${year}-Q${quarter}`,
      label: `Q${quarter}`,
      year,
      quarter,
      start,
      end
    };
  });
}

function roadmapItemXPercent(item: DeliveryRoadmapItem, quarters: RoadmapFixedQuarter[]): number | null {
  const quarterCount = quarters.length;
  if (quarterCount === 0) return null;

  if (item.targetDate) {
    const date = new Date(`${item.targetDate}T00:00:00`);
    const quarterIndex = quarters.findIndex((quarter) => date >= quarter.start && date < quarter.end);
    if (quarterIndex < 0) return null;
    const quarterDuration = quarters[quarterIndex].end.getTime() - quarters[quarterIndex].start.getTime();
    const dateOffset = date.getTime() - quarters[quarterIndex].start.getTime();
    const inQuarterRatio = quarterDuration > 0 ? dateOffset / quarterDuration : 0.5;
    return ((quarterIndex + Math.min(0.96, Math.max(0.04, inQuarterRatio))) / quarterCount) * 100;
  }

  const quarterIndex = quarters.findIndex((quarter) => quarter.key === item.targetQuarter);
  if (quarterIndex < 0) return null;
  return ((quarterIndex + 0.5) / quarterCount) * 100;
}

function RoadmapCarIcon({ color }: { color: string }) {
  return (
    <svg className="roadmap-car-icon" viewBox="0 0 64 42" aria-hidden="true">
      <path
        d="M10 25h5l7-10h20l8 10h4c3 0 5 2 5 5v3H6v-3c0-3 1-5 4-5Z"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 25h22M25 15l-3 10M42 15l5 10" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <circle cx="19" cy="33" r="5" fill={color} />
      <circle cx="48" cy="33" r="5" fill={color} />
    </svg>
  );
}

export default function DashboardView({
  canWrite,
  overview,
  clusterRiskBoard,
  onRefreshClusterRiskBoard,
  deliveryRoadmap,
  onRefreshDeliveryRoadmap,
  projects,
  selectedProjectId,
  selectedProjectIds,
  onToggleProjectSelection,
  onDeleteSelectedProjects,
  onSubmitProject,
  onDeleteProject,
  projectEdit,
  onSaveProject,
  onInlineKeyDown
}: Props) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectKeyword, setProjectKeyword] = useState('');
  const [clusterRiskFilter, setClusterRiskFilter] = useState<'all' | ClusterRiskLight>('all');
  const [clusterDemoFilter, setClusterDemoFilter] = useState<'all' | 'yes' | 'no' | 'unknown'>('all');
  const [clusterKeyword, setClusterKeyword] = useState('');
  const [clusterFullscreen, setClusterFullscreen] = useState(false);
  const [selectedClusterProject, setSelectedClusterProject] = useState<ClusterRiskBoardItem | null>(null);
  const [clusterRefreshing, setClusterRefreshing] = useState(false);
  const [dashboardBoardTab, setDashboardBoardTab] = useState<'cluster' | 'roadmap'>('cluster');
  const [roadmapFullscreen, setRoadmapFullscreen] = useState(false);
  const [roadmapRefreshing, setRoadmapRefreshing] = useState(false);
  const canUsePortal = typeof window !== 'undefined' && typeof document !== 'undefined';

  async function submitCreateProject(e: FormEvent<HTMLFormElement>) {
    await Promise.resolve(onSubmitProject(e));
    setShowCreateModal(false);
  }

  const summary = useMemo(() => {
    const allItems = overview?.projects || [];
    const items = selectedProjectId
      ? allItems.filter((item) => item.projectId === selectedProjectId)
      : allItems;
    const totalBudget = items.reduce((sum, item) => sum + (item.budget || 0), 0);
    const totalActual = items.reduce((sum, item) => sum + (item.actualCost || 0), 0);
    const blocked = items.reduce((sum, item) => sum + item.blockedTasks, 0);
    const avgHealth = items.length > 0 ? Math.round(items.reduce((sum, item) => sum + item.healthScore, 0) / items.length) : 0;
    return {
      totalBudget,
      totalActual,
      blocked,
      avgHealth,
      varianceRate: totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0
    };
  }, [overview, selectedProjectId]);

  const topRiskProjects = useMemo(() => {
    const allItems = overview?.projects || [];
    const items = selectedProjectId
      ? allItems.filter((item) => item.projectId === selectedProjectId)
      : allItems;
    return [...items].sort((a, b) => a.healthScore - b.healthScore).slice(0, 5);
  }, [overview, selectedProjectId]);

  const visibleProjectBudgets = useMemo(() => {
    const allItems = overview?.projects || [];
    const items = selectedProjectId
      ? allItems.filter((item) => item.projectId === selectedProjectId)
      : allItems;
    return [...items].sort((a, b) => a.projectId - b.projectId);
  }, [overview, selectedProjectId]);

  const filteredProjects = useMemo(() => {
    const keyword = projectKeyword.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((project) => {
      const text = `${project.name || ''} ${project.alias || ''}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [projectKeyword, projects]);

  const clusterItems = clusterRiskBoard?.items || [];
  const filteredClusterItems = useMemo(() => {
    const keyword = clusterKeyword.trim().toLowerCase();
    return clusterItems.filter((item) => {
      if (clusterRiskFilter !== 'all' && item.riskLight !== clusterRiskFilter) return false;
      if (clusterDemoFilter === 'yes' && item.hasKeyDemo !== true) return false;
      if (clusterDemoFilter === 'no' && item.hasKeyDemo !== false) return false;
      if (clusterDemoFilter === 'unknown' && item.hasKeyDemo !== null) return false;
      if (!keyword) return true;
      const text = [
        item.projectName,
        item.projectId,
        item.ownerPm,
        item.deliveryScope,
        item.weeklyProgress,
        item.dailyRiskHelp,
        item.riskResolution,
        item.qualityGap,
        item.qualityLevel
      ].join(' ').toLowerCase();
      return text.includes(keyword);
    });
  }, [clusterDemoFilter, clusterItems, clusterKeyword, clusterRiskFilter]);

  const clusterSummary = useMemo(() => countFilteredClusterSummary(filteredClusterItems), [filteredClusterItems]);
  const clusterFocus = useMemo(() => ({
    red: filteredClusterItems.filter((item) => item.riskLight === '红灯'),
    daily: filteredClusterItems.filter((item) => item.dailyRiskHelp.trim()),
    demo: filteredClusterItems.filter((item) => item.hasKeyDemo === true),
    quality: filteredClusterItems.filter((item) => item.qualityLevel.includes('高') || item.qualityGap.includes('高风险'))
  }), [filteredClusterItems]);

  async function refreshClusterBoard() {
    setClusterRefreshing(true);
    try {
      await onRefreshClusterRiskBoard();
    } finally {
      setClusterRefreshing(false);
    }
  }

  async function refreshRoadmapBoard() {
    setRoadmapRefreshing(true);
    try {
      await onRefreshDeliveryRoadmap();
    } finally {
      setRoadmapRefreshing(false);
    }
  }

  const clusterBoard = (
    <section className={`cluster-board ${clusterFullscreen ? 'cluster-board-fullscreen' : ''}`}>
      <div className="cluster-board-head">
        <div>
          <p className="cluster-board-eyebrow">Executive cockpit</p>
          <h2>集群风险状态大看板</h2>
          <p className="muted">只读展示飞书周报数据，聚焦项目风险灯、重点演示、Daily 风险求助和质量 GAP。</p>
        </div>
        <div className="cluster-board-actions">
          <span className={`cluster-source-pill ${clusterRiskBoard?.source === 'feishu' ? 'ok' : 'warn'}`}>
            {clusterRiskBoard?.source === 'feishu' ? '飞书在线' : '数据源未就绪'}
          </span>
          <button className="btn" type="button" onClick={() => void refreshClusterBoard()} disabled={clusterRefreshing}>
            {clusterRefreshing ? '刷新中...' : '刷新'}
          </button>
          <button className="btn" type="button" onClick={() => setClusterFullscreen((prev) => !prev)}>
            {clusterFullscreen ? '退出全屏' : '全屏'}
          </button>
        </div>
      </div>

      {clusterRiskBoard?.error && (
        <div className="cluster-board-alert">
          {clusterRiskBoard.error}
        </div>
      )}

      <div className="cluster-board-kpis">
        <article className="cluster-kpi">
          <span>项目总数</span>
          <strong>{clusterSummary.totalProjects}</strong>
        </article>
        <article className="cluster-kpi danger">
          <span>红灯</span>
          <strong>{clusterSummary.redCount}</strong>
        </article>
        <article className="cluster-kpi warning">
          <span>黄灯</span>
          <strong>{clusterSummary.yellowCount}</strong>
        </article>
        <article className="cluster-kpi good">
          <span>绿灯</span>
          <strong>{clusterSummary.greenCount}</strong>
        </article>
        <article className="cluster-kpi">
          <span>近期演示</span>
          <strong>{clusterSummary.keyDemoCount}</strong>
        </article>
        <article className="cluster-kpi danger">
          <span>Daily 求助</span>
          <strong>{clusterSummary.dailyRiskHelpCount}</strong>
        </article>
        <article className="cluster-kpi warning">
          <span>质量高风险</span>
          <strong>{clusterSummary.highQualityRiskCount}</strong>
        </article>
      </div>

      <div className="cluster-board-filters">
        <input placeholder="搜索项目 / 负责人 / 风险文本" value={clusterKeyword} onChange={(e) => setClusterKeyword(e.target.value)} />
        <select value={clusterRiskFilter} onChange={(e) => setClusterRiskFilter(e.target.value as 'all' | ClusterRiskLight)}>
          <option value="all">全部风险灯</option>
          <option value="红灯">红灯</option>
          <option value="黄灯">黄灯</option>
          <option value="绿灯">绿灯</option>
          <option value="未填">未填</option>
        </select>
        <select value={clusterDemoFilter} onChange={(e) => setClusterDemoFilter(e.target.value as 'all' | 'yes' | 'no' | 'unknown')}>
          <option value="all">全部演示状态</option>
          <option value="yes">近期重点演示</option>
          <option value="no">非近期演示</option>
          <option value="unknown">待确认</option>
        </select>
      </div>

      <div className="cluster-main-grid">
        <article className="cluster-health-map">
          <div className="section-title-row">
            <h3>项目健康地图</h3>
            <span className="muted">红灯优先排序</span>
          </div>
          <div className="cluster-project-grid">
            {filteredClusterItems.map((item) => (
              <button
                key={`${item.index}-${item.projectName}-${item.projectId}`}
                className={`cluster-project-card ${riskToneClass(item.riskLight)}`}
                type="button"
                onClick={() => setSelectedClusterProject(item)}
              >
                <div className="cluster-project-title-row">
                  <strong>{item.projectName || '未命名项目'}</strong>
                  <span className={`cluster-risk-badge ${riskToneClass(item.riskLight)}`}>{item.riskLight}</span>
                </div>
                <span className="muted">{item.projectId || '未立项'} · {item.ownerPm || '未填 PM'}</span>
                <p>{excerpt(item.weeklyProgress || item.deliveryScope, 78)}</p>
                <div className="cluster-card-tags">
                  <span>{keyDemoLabel(item.hasKeyDemo)}</span>
                  {item.dailyRiskHelp && <span className="danger">Daily 求助</span>}
                  {item.qualityLevel && <span>质量 {item.qualityLevel}</span>}
                </div>
              </button>
            ))}
            {filteredClusterItems.length === 0 && (
              <div className="cluster-empty">暂无匹配项目。请检查筛选条件或大看板数据源配置。</div>
            )}
          </div>
        </article>

        <aside className="cluster-focus-panel">
          <h3>管理层关注</h3>
          {[
            ['红灯项目', clusterFocus.red],
            ['Daily 风险求助', clusterFocus.daily],
            ['近期重点演示', clusterFocus.demo],
            ['质量高风险', clusterFocus.quality]
          ].map(([title, list]) => (
            <div className="cluster-focus-group" key={String(title)}>
              <div className="cluster-focus-title">
                <strong>{String(title)}</strong>
                <span>{(list as ClusterRiskBoardItem[]).length}</span>
              </div>
              {(list as ClusterRiskBoardItem[]).slice(0, 5).map((item) => (
                <button key={`${title}-${item.index}-${item.projectName}`} type="button" onClick={() => setSelectedClusterProject(item)}>
                  {item.projectName || '未命名项目'}
                </button>
              ))}
              {(list as ClusterRiskBoardItem[]).length === 0 && <p className="muted">暂无</p>}
            </div>
          ))}
        </aside>
      </div>

      <div className="cluster-lanes">
        {(['红灯', '黄灯', '绿灯', '未填'] as ClusterRiskLight[]).map((light) => (
          <article className={`cluster-lane ${riskToneClass(light)}`} key={light}>
            <h4>{light}</h4>
            {filteredClusterItems.filter((item) => item.riskLight === light).slice(0, 6).map((item) => (
              <button key={`${light}-${item.index}-${item.projectName}`} type="button" onClick={() => setSelectedClusterProject(item)}>
                <strong>{item.projectName || '未命名项目'}</strong>
                <span>{excerpt(item.dailyRiskHelp || item.riskResolution || item.qualityGap, 64)}</span>
              </button>
            ))}
          </article>
        ))}
      </div>

    </section>
  );

  const fixedRoadmapQuarters = useMemo(() => buildFixedRoadmapQuarters(7), []);
  const quarterWidthPercent = `${100 / fixedRoadmapQuarters.length}%`;
  const roadmapYearSpans = useMemo(() => {
    const quarters = fixedRoadmapQuarters;
    return Array.from(new Set(quarters.map((quarter) => quarter.year))).map((year) => ({
      year,
      count: quarters.filter((quarter) => quarter.year === year).length
    }));
  }, [fixedRoadmapQuarters]);
  const roadmapLaneGroups = useMemo(() => {
    const lanes = deliveryRoadmap?.lanes || [];
    return lanes.reduce<Array<{ categoryL1: string; tone: 'main' | 'factory' | 'other'; lanes: typeof lanes }>>((groups, lane) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.categoryL1 === lane.categoryL1) {
        lastGroup.lanes.push(lane);
        return groups;
      }
      groups.push({
        categoryL1: lane.categoryL1,
        tone: roadmapLaneTone(lane.categoryL1),
        lanes: [lane]
      });
      return groups;
    }, []);
  }, [deliveryRoadmap]);

  const roadmapBoard = (
    <section className={`delivery-roadmap-board ${roadmapFullscreen ? 'delivery-roadmap-fullscreen' : ''}`}>
      <div className="delivery-roadmap-head">
        <div>
          <p className="cluster-board-eyebrow">Delivery roadmap</p>
          <h2>公司交付车型大图 (1.0+、1.5、2.0、端侧智能)</h2>
          <p className="muted">只读展示飞书宽表数据，按季度时间轴呈现主线、车厂交付和端侧智能节点。</p>
        </div>
        <div className="cluster-board-actions">
          <span className={`cluster-source-pill ${deliveryRoadmap?.source === 'feishu' ? 'ok' : 'warn'}`}>
            {deliveryRoadmap?.source === 'feishu' ? '飞书在线' : '数据源未就绪'}
          </span>
          <button className="btn" type="button" onClick={() => void refreshRoadmapBoard()} disabled={roadmapRefreshing}>
            {roadmapRefreshing ? '刷新中...' : '刷新'}
          </button>
          <button className="btn" type="button" onClick={() => setRoadmapFullscreen((prev) => !prev)}>
            {roadmapFullscreen ? '退出全屏' : '全屏'}
          </button>
        </div>
      </div>

      {deliveryRoadmap?.error && (
        <div className="cluster-board-alert">
          {deliveryRoadmap.error}
        </div>
      )}

      {(deliveryRoadmap?.lanes.length || 0) === 0 ? (
        <div className="cluster-empty">暂无路线图数据。请检查 DELIVERY_ROADMAP_* 配置或飞书字段映射。</div>
      ) : (
        <>
          <div className="roadmap-chart-scroll">
            <div className="roadmap-canvas">
              <div className="roadmap-header-row">
                <div className="roadmap-left-header" />
                <div className="roadmap-time-header">
                  <div className="roadmap-year-row">
                    {roadmapYearSpans.map((span) => (
                      <div key={span.year} style={{ width: `${(span.count / fixedRoadmapQuarters.length) * 100}%` }}>{span.year}</div>
                    ))}
                  </div>
                  <div className="roadmap-quarter-row">
                    {fixedRoadmapQuarters.map((quarter) => (
                      <div key={quarter.key} style={{ width: quarterWidthPercent }}>{quarter.label}</div>
                    ))}
                  </div>
                </div>
              </div>

              {roadmapLaneGroups.map((group) => (
                <div className={`roadmap-lane-group ${group.tone}`} key={group.categoryL1}>
                  <div className="roadmap-group-label">
                    <span>{group.categoryL1}</span>
                  </div>
                  <div className="roadmap-group-rows">
                    {group.lanes.map((lane) => {
                      return (
                        <div className={`roadmap-lane-row ${group.tone}`} key={lane.id}>
                          <div className="roadmap-left-cell">
                            <strong>{lane.categoryL2}</strong>
                          </div>
                          <div className="roadmap-lane-track">
                            {fixedRoadmapQuarters.map((quarter) => (
                              <div className="roadmap-quarter-grid" key={`${lane.id}-${quarter.key}`} style={{ width: quarterWidthPercent }} />
                            ))}
                            {lane.items.map((item) => {
                              const color = roadmapIconColor(item, deliveryRoadmap);
                              const xPercent = roadmapItemXPercent(item, fixedRoadmapQuarters);
                              if (xPercent === null) return null;
                              return (
                                <article className="roadmap-node" key={item.id} style={{ left: `${xPercent}%`, color }}>
                                  {item.hasFlag && <span className="roadmap-flag" />}
                                  <RoadmapCarIcon color={color} />
                                  <strong>{item.milestoneName || '未命名节点'}</strong>
                                  {item.techDetail && <span className="roadmap-tech">({item.techDetail})</span>}
                                  <span className="roadmap-node-dot" style={{ background: color }} />
                                  <em>{roadmapDateLabel(item)}</em>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="roadmap-legend">
            {(deliveryRoadmap?.legend || []).map((item) => (
              <span key={item.iconStyle}>
                <RoadmapCarIcon color={item.color} />
                {item.label}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );

  return (
    <div>
      <div className="dashboard-board-tabs">
        <button
          className={dashboardBoardTab === 'cluster' ? 'active' : ''}
          type="button"
          onClick={() => setDashboardBoardTab('cluster')}
        >
          集群风险状态
        </button>
        <button
          className={dashboardBoardTab === 'roadmap' ? 'active' : ''}
          type="button"
          onClick={() => setDashboardBoardTab('roadmap')}
        >
          公司交付车型
        </button>
      </div>

      {dashboardBoardTab === 'cluster' ? clusterBoard : roadmapBoard}

      {false && (
      <>
      <section className="metrics-grid">
        <article className="metric-card">
          <p className="metric-label">项目总数</p>
          <p className="metric-value">{overview?.summary.projectCount ?? 0}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">高风险项目</p>
          <p className="metric-value danger">{overview?.summary.riskProjectCount ?? 0}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">阻塞任务</p>
          <p className="metric-value warning">{summary.blocked}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">预算使用率</p>
          <p className="metric-value">{summary.varianceRate}%</p>
          <div className="progress-track">
            <div className={`progress-fill ${summary.varianceRate > 100 ? 'danger' : 'good'}`} style={{ width: `${Math.min(summary.varianceRate, 100)}%` }} />
          </div>
        </article>
      </section>

      <section className="dashboard-panels dashboard-panels-gap">
        <article className="card compact-card">
          <div className="section-title-row">
            <h3>风险优先项目</h3>
            <span className="muted">按健康分从低到高</span>
          </div>
          <div className="risk-rank-list">
            {topRiskProjects.length === 0 && <p className="muted">暂无数据</p>}
            {topRiskProjects.map((project, index) => (
              <div key={project.projectId} className="risk-rank-row">
                <span className="risk-rank-index">{index + 1}</span>
                <div className="risk-rank-main">
                  <strong>{project.projectName}</strong>
                  <span className="muted">阻塞 {project.blockedTasks} · 偏差 {project.varianceRate}%</span>
                </div>
                <span className={`health-pill ${healthTone(project.healthScore)}`}>健康度 {project.healthScore}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card compact-card">
          <div className="section-title-row">
            <h3>预算概览</h3>
            <span className="muted">跨项目累计</span>
          </div>
          <div className="budget-kpis">
            <div>
              <p className="metric-label">总预算</p>
              <p className="metric-value">¥{formatMoney(summary.totalBudget)}</p>
            </div>
            <div>
              <p className="metric-label">总实际</p>
              <p className={`metric-value ${summary.totalActual > summary.totalBudget ? 'danger' : 'good'}`}>
                ¥{formatMoney(summary.totalActual)}
              </p>
            </div>
            <div>
              <p className="metric-label">平均健康度</p>
              <p className="metric-value">{summary.avgHealth}</p>
            </div>
          </div>
          <div className="dashboard-budget-detail">
            {visibleProjectBudgets.length > 0 ? (
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>项目</th>
                    <th>预算</th>
                    <th>实际</th>
                    <th>偏差</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProjectBudgets.map((item) => (
                    <tr key={`budget-${item.projectId}`}>
                      <td>{item.projectName}</td>
                      <td>¥{formatMoney(item.budget)}</td>
                      <td className={item.actualCost > item.budget ? 'danger' : 'good'}>¥{formatMoney(item.actualCost)}</td>
                      <td className={item.varianceRate > 0 ? 'danger' : 'good'}>{item.varianceRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">暂无可见项目预算数据。</p>
            )}
          </div>
        </article>
      </section>

      <div className="card req-mt-12">
        <div className="section-title-row">
          <h3>项目管理</h3>
          {canWrite && (
            <div className="dashboard-project-actions">
              <button className="btn btn-primary" type="button" onClick={() => setShowCreateModal(true)}>
                新建项目
              </button>
              <button className="btn" type="button" disabled={selectedProjectIds.length === 0} onClick={onDeleteSelectedProjects}>
                批量删除 ({selectedProjectIds.length})
              </button>
            </div>
          )}
        </div>
        <div className="filters-grid req-filters-grid">
          <input
            placeholder="筛选项目名称/别名"
            value={projectKeyword}
            onChange={(e) => setProjectKeyword(e.target.value)}
          />
        </div>

        <table className="table">
          <thead>
            <tr>
              {canWrite && (
                <th>
                  <input
                    type="checkbox"
                    checked={filteredProjects.length > 0 && filteredProjects.every((project) => selectedProjectIds.includes(project.id))}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      filteredProjects.forEach((project) => onToggleProjectSelection(project.id, checked));
                    }}
                  />
                </th>
              )}
              <th>名称</th>
              <th>别名</th>
              <th>预算</th>
              <th>开始</th>
              <th>结束</th>
              <th>群聊 ChatID</th>
              <th>飞书 App Token</th>
              <th>飞书 Table ID</th>
              {canWrite && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project) => {
              const isEditing = projectEdit.editingId === project.id;
              const rowDraft = isEditing ? (projectEdit.draft ?? project) : project;
              const isDirty = isEditing && projectEdit.hasDirty(project);

              return (
                <tr key={project.id} className={isEditing ? 'editing-row' : ''}>
                  {canWrite && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={(e) => onToggleProjectSelection(project.id, e.target.checked)}
                      />
                    </td>
                  )}
                  <td
                    className={isEditing && projectEdit.editingField === 'name' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'name')}
                  >
                    {isEditing && projectEdit.editingField === 'name' ? (
                      <input
                        data-project-edit={`${project.id}-name`}
                        value={rowDraft.name ?? ''}
                        onChange={(e) => projectEdit.updateDraft('name', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.name
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'alias' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'alias')}
                  >
                    {isEditing && projectEdit.editingField === 'alias' ? (
                      <input
                        data-project-edit={`${project.id}-alias`}
                        value={rowDraft.alias ?? ''}
                        onChange={(e) => projectEdit.updateDraft('alias', e.target.value.toUpperCase())}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.alias || '-'
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'budget' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'budget')}
                  >
                    {isEditing && projectEdit.editingField === 'budget' ? (
                      <input
                        data-project-edit={`${project.id}-budget`}
                        type="number"
                        step="0.01"
                        value={rowDraft.budget ?? ''}
                        onChange={(e) => projectEdit.updateDraft('budget', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.budget
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'startDate' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'startDate')}
                  >
                    {isEditing && projectEdit.editingField === 'startDate' ? (
                      <input
                        data-project-edit={`${project.id}-startDate`}
                        type="date"
                        value={rowDraft.startDate ?? ''}
                        onChange={(e) => projectEdit.updateDraft('startDate', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.startDate || '-'
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'endDate' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'endDate')}
                  >
                    {isEditing && projectEdit.editingField === 'endDate' ? (
                      <input
                        data-project-edit={`${project.id}-endDate`}
                        type="date"
                        value={rowDraft.endDate ?? ''}
                        onChange={(e) => projectEdit.updateDraft('endDate', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.endDate || '-'
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'feishuChatIds' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'feishuChatIds')}
                  >
                    {isEditing && projectEdit.editingField === 'feishuChatIds' ? (
                      <input
                        data-project-edit={`${project.id}-feishuChatIds`}
                        value={rowDraft.feishuChatIds ?? ''}
                        onChange={(e) => projectEdit.updateDraft('feishuChatIds', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.feishuChatIds || '-'
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'feishuAppToken' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'feishuAppToken')}
                  >
                    {isEditing && projectEdit.editingField === 'feishuAppToken' ? (
                      <input
                        data-project-edit={`${project.id}-feishuAppToken`}
                        value={rowDraft.feishuAppToken ?? ''}
                        onChange={(e) => projectEdit.updateDraft('feishuAppToken', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.feishuAppToken
                        ? <span title={rowDraft.feishuAppToken ?? ''}>已配置</span>
                        : <span className="muted">-</span>
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'feishuTableId' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'feishuTableId')}
                  >
                    {isEditing && projectEdit.editingField === 'feishuTableId' ? (
                      <input
                        data-project-edit={`${project.id}-feishuTableId`}
                        value={rowDraft.feishuTableId ?? ''}
                        onChange={(e) => projectEdit.updateDraft('feishuTableId', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.feishuTableId
                        ? <span title={rowDraft.feishuTableId ?? ''}>已配置</span>
                        : <span className="muted">-</span>
                    )}
                  </td>

                  {canWrite && (
                    <td className="req-inline-actions">
                      {isEditing && isDirty ? (
                        <>
                          <button className="btn" type="button" onClick={() => onSaveProject(project)}>
                            保存
                          </button>
                          <button className="btn" type="button" onClick={projectEdit.cancel}>
                            取消
                          </button>
                        </>
                      ) : (
                        <button className="btn dashboard-project-delete-btn" type="button" onClick={() => onDeleteProject(project)}>
                          删除
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 10 : 9} className="req-muted-cell">没有匹配的项目</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && canUsePortal && createPortal(
        <div className="req-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="req-modal dashboard-project-modal" onClick={(e) => e.stopPropagation()}>
            <div className="req-modal-head">
              <h3>新建项目</h3>
              <div className="dashboard-project-modal-head-actions">
                <button className="btn btn-primary" form="dashboard-project-create-form" type="submit">创建项目</button>
                <button className="btn" type="button" onClick={() => setShowCreateModal(false)}>关闭</button>
              </div>
            </div>
            <form id="dashboard-project-create-form" className="dashboard-project-modal-form" onSubmit={submitCreateProject}>
              <input name="name" placeholder="项目名称" required />
              <input name="alias" placeholder="项目别名（大写英文）" required />
              <input name="budget" type="number" step="0.01" placeholder="预算" required />
              <input name="startDate" type="date" />
              <input name="endDate" type="date" />
              <input name="feishuChatIds" placeholder="飞书群 ChatID（逗号分隔）" />
              <input name="feishuAppToken" placeholder="飞书多维表格 App Token（可选）" />
              <input name="feishuTableId" placeholder="飞书多维表格 Table ID（可选）" />
            </form>
          </div>
        </div>,
        document.body
      )}
      </>
      )}

      {selectedClusterProject && canUsePortal && createPortal(
        <div className="cluster-detail-backdrop" onClick={() => setSelectedClusterProject(null)}>
          <aside className="cluster-detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cluster-detail-head">
              <div>
                <span className={`cluster-risk-badge ${riskToneClass(selectedClusterProject.riskLight)}`}>
                  {selectedClusterProject.riskLight}
                </span>
                <h3>{selectedClusterProject.projectName || '未命名项目'}</h3>
                <p className="muted">{selectedClusterProject.projectId || '未立项'} · {selectedClusterProject.ownerPm || '未填 PM'}</p>
              </div>
              <button className="btn" type="button" onClick={() => setSelectedClusterProject(null)}>关闭</button>
            </div>
            {[
              ['交付范围', selectedClusterProject.deliveryScope],
              ['近期重点演示', keyDemoLabel(selectedClusterProject.hasKeyDemo)],
              ['周进展（PM）', selectedClusterProject.weeklyProgress],
              ['Daily 风险求助（PM）', selectedClusterProject.dailyRiskHelp],
              ['风险解决情况', selectedClusterProject.riskResolution],
              ['质量状态与 GAP', selectedClusterProject.qualityGap],
              ['质量等级', selectedClusterProject.qualityLevel]
            ].map(([label, value]) => (
              <section className="cluster-detail-field" key={label}>
                <h4>{label}</h4>
                <p>{value || '-'}</p>
              </section>
            ))}
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
}
