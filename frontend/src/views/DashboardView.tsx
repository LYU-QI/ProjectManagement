import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ClusterRiskBoardItem,
  ClusterRiskBoardResponse,
  ClusterRiskLight,
  DashboardOverview,
  DeliveryRoadmapItem,
  DeliveryRoadmapResponse,
  ProjectItem,
  ResourceCalendarCell,
  ResourceCalendarPerson,
  ResourceCalendarResponse
} from '../types';
import ThemedSelect from '../components/ui/ThemedSelect';

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

type ResourceCalendarRangeFilter = 'thisWeek' | 'thisMonth' | 'next4Weeks' | 'next8Weeks';
type ResourceCalendarLoadFilter = 'all' | ResourceCalendarCell['status'];
type ResourceCalendarColumn = {
  key: string;
  label: string;
  tooltipLabel: string;
  dates: string[];
  mode: 'day' | 'week';
};
type ResourceCalendarDisplayCell = {
  availablePercent: number;
  allocatedPercent: number;
  allocatedDays: number;
  status: ResourceCalendarCell['status'];
  projects: Array<{
    projectId: string;
    projectName: string;
    role: string;
    allocationPercent: number;
  }>;
};
type ResourceCalendarTooltipState = {
  x: number;
  y: number;
  placement: 'top' | 'bottom';
  personName: string;
  label: string;
  mode: ResourceCalendarColumn['mode'];
  cell: ResourceCalendarDisplayCell;
};

type Props = {
  canWrite: boolean;
  overview: DashboardOverview | null;
  clusterRiskBoard: ClusterRiskBoardResponse | null;
  onRefreshClusterRiskBoard: () => Promise<void>;
  deliveryRoadmap: DeliveryRoadmapResponse | null;
  onRefreshDeliveryRoadmap: () => Promise<void>;
  resourceCalendar: ResourceCalendarResponse | null;
  onRefreshResourceCalendar: () => Promise<void>;
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

type ClusterDetailField = {
  label: string;
  value: string;
  tone?: 'default' | 'danger' | 'action';
  wide?: boolean;
};

type ClusterUrgency = {
  level: 1 | 2 | 3 | 4;
  label: '低' | '中' | '高' | '特急';
  icon: string;
  className: 'low' | 'medium' | 'high' | 'critical';
};

const CLUSTER_RISK_ORDER: ClusterRiskLight[] = ['红灯', '黄灯', '绿灯', '未填'];

function cleanDetailValue(value: unknown): string {
  return String(value ?? '').trim();
}

function clusterDetailField(label: string, value: unknown, options: Omit<ClusterDetailField, 'label' | 'value'> = {}): ClusterDetailField | null {
  const text = cleanDetailValue(value);
  if (!text) return null;
  return { label, value: text, ...options };
}

function clusterDetailDisplayField(label: string, value: unknown, options: Omit<ClusterDetailField, 'label' | 'value'> = {}): ClusterDetailField {
  return { label, value: cleanDetailValue(value) || '-', ...options };
}

function clusterProjectManager(item: ClusterRiskBoardItem): string {
  return cleanDetailValue(item.pm || item.ownerPm) || '未填 PM';
}

function hasClusterCriticalSignal(item: ClusterRiskBoardItem): boolean {
  const escalation = `${item.needsEscalation || ''} ${item.escalationRequest || ''}`.trim();
  const quality = `${item.qualityLevel || ''} ${item.qualityGap || ''}`.toLowerCase();
  return Boolean(
    item.dailyRiskHelp.trim() ||
    item.urgentStaffingGap.trim() ||
    escalation ||
    item.keyRiskSummary.trim() ||
    quality.includes('高风险') ||
    quality.includes('严重') ||
    quality.includes('critical') ||
    quality.includes('high')
  );
}

function clusterUrgency(item: ClusterRiskBoardItem): ClusterUrgency {
  const hasSignal = hasClusterCriticalSignal(item);
  if (item.riskLight === '红灯' && hasSignal) return { level: 4, label: '特急', icon: '🔥🔥🔥🔥', className: 'critical' };
  if (item.riskLight === '红灯' || (item.riskLight === '黄灯' && hasSignal)) return { level: 3, label: '高', icon: '🔥🔥🔥', className: 'high' };
  if (item.riskLight === '黄灯' || hasSignal) return { level: 2, label: '中', icon: '🔥🔥', className: 'medium' };
  return { level: 1, label: '低', icon: '🔥', className: 'low' };
}

function ClusterDetailValue({ field }: { field: ClusterDetailField }) {
  const isLong = field.value.length > 180 || field.value.includes('\n');
  if (isLong) {
    return (
      <details className="cluster-detail-long" open={field.value.length <= 260}>
        <summary>{field.label}</summary>
        <p>{field.value}</p>
      </details>
    );
  }
  return (
    <div className={`cluster-detail-data ${field.wide ? 'wide' : ''} ${field.tone || ''}`}>
      <span>{field.label}</span>
      <strong>{field.value}</strong>
    </div>
  );
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
  const primaryDate = item.plannedDeliveryDate || item.targetDate;
  const date = primaryDate ? primaryDate.slice(5).replace('-', '/') : (item.targetQuarter || '未定');
  return item.isTbd ? `${date}（待定）` : date;
}

function roadmapIconColor(item: DeliveryRoadmapItem, roadmap: DeliveryRoadmapResponse | null): string {
  return roadmap?.legend.find((legend) => legend.iconStyle === item.iconStyle)?.color || '#64748b';
}

function roadmapDetailRows(item: DeliveryRoadmapItem): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['车型/版本', item.vehicleVersionName],
    ['里程碑类型', item.milestoneType],
    ['计划交付', roadmapDateLabel(item)],
    ['承诺交付', item.committedDeliveryDate],
    ['实际完成', item.actualDeliveryDate],
    ['技术细节', item.techDetail],
    ['交付状态', item.deliveryStatus],
    ['车型负责人', item.vehicleOwner],
    ['风险等级', item.riskLevel],
    ['更新时间', item.updatedAt],
    ['关键风险', item.keyRisk],
    ['最新进展', item.latestProgress],
    ['下一步动作', item.nextAction],
    ['依赖项', item.dependencies]
  ];
  return rows.filter(([, value]) => Boolean(value?.trim()));
}

function resourceCellStatusLabel(status: ResourceCalendarCell['status']): string {
  if (status === 'overloaded') return '过载';
  if (status === 'saturated') return '饱和';
  if (status === 'normal') return '已排';
  if (status === 'unavailable') return '不可用';
  return '空闲';
}

function resourceCellFor(person: ResourceCalendarPerson, date: string, cells: ResourceCalendarCell[]): ResourceCalendarCell | null {
  return cells.find((cell) => cell.personId === (person.personId || person.name) && cell.date === date) || null;
}

function roundResourceNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

function resourceRangeLabel(range: ResourceCalendarRangeFilter): string {
  if (range === 'thisWeek') return '本周';
  if (range === 'thisMonth') return '本月';
  if (range === 'next8Weeks') return '未来 8 周';
  return '未来 4 周';
}

function filterResourceDays(days: string[], range: ResourceCalendarRangeFilter): string[] {
  if (range === 'next4Weeks') return days.slice(0, 28);
  if (range === 'next8Weeks') return days.slice(0, 56);

  const firstDay = days[0] ? parseDateKey(days[0]) : new Date();
  if (range === 'thisMonth') {
    const year = firstDay.getFullYear();
    const month = firstDay.getMonth();
    return days.filter((date) => {
      const current = parseDateKey(date);
      return current.getFullYear() === year && current.getMonth() === month;
    });
  }

  const weekEnd = new Date(firstDay);
  weekEnd.setDate(firstDay.getDate() + ((7 - firstDay.getDay()) % 7));
  return days.filter((date) => parseDateKey(date) <= weekEnd);
}

function buildResourceColumns(days: string[], range: ResourceCalendarRangeFilter): ResourceCalendarColumn[] {
  if (range !== 'next8Weeks') {
    return days.map((date) => ({
      key: date,
      label: date.slice(5),
      tooltipLabel: date,
      dates: [date],
      mode: 'day'
    }));
  }

  const columns: ResourceCalendarColumn[] = [];
  for (let index = 0; index < days.length; index += 7) {
    const weekDays = days.slice(index, index + 7);
    const start = weekDays[0] || '';
    const end = weekDays[weekDays.length - 1] || start;
    columns.push({
      key: `${start}::${end}`,
      label: `${start.slice(5)}-${end.slice(5)}`,
      tooltipLabel: `${start} 至 ${end}`,
      dates: weekDays,
      mode: 'week'
    });
  }
  return columns;
}

function summarizeResourceCells(cells: ResourceCalendarCell[]): ResourceCalendarDisplayCell {
  if (cells.length === 0) {
    return {
      availablePercent: 100,
      allocatedPercent: 0,
      allocatedDays: 0,
      status: 'idle',
      projects: []
    };
  }

  const availablePercent = roundResourceNumber(cells.reduce((sum, cell) => sum + cell.availablePercent, 0) / cells.length);
  const allocatedPercent = roundResourceNumber(cells.reduce((sum, cell) => sum + cell.allocatedPercent, 0) / cells.length);
  const allocatedDays = roundResourceNumber(cells.reduce((sum, cell) => sum + cell.allocatedDays, 0));
  const statuses = new Set(cells.map((cell) => cell.status));
  const projectMap = new Map<string, ResourceCalendarDisplayCell['projects'][number] & { count: number }>();
  for (const cell of cells) {
    for (const project of cell.projects || []) {
      const key = project.projectId || project.projectName || 'unknown';
      const existing = projectMap.get(key) || {
        projectId: project.projectId,
        projectName: project.projectName,
        role: project.role,
        allocationPercent: 0,
        count: 0
      };
      existing.allocationPercent += project.allocationPercent;
      existing.count += 1;
      projectMap.set(key, existing);
    }
  }
  const projects = Array.from(projectMap.values()).map((project) => ({
    projectId: project.projectId,
    projectName: project.projectName,
    role: project.role,
    allocationPercent: roundResourceNumber(project.allocationPercent / Math.max(project.count, 1))
  }));

  let status: ResourceCalendarCell['status'] = 'idle';
  if (statuses.has('overloaded')) status = 'overloaded';
  else if (statuses.has('saturated')) status = 'saturated';
  else if (statuses.has('normal')) status = 'normal';
  else if (statuses.has('unavailable')) status = 'unavailable';

  return {
    availablePercent,
    allocatedPercent,
    allocatedDays,
    status,
    projects
  };
}

function resourceConflictRank(conflict: ResourceCalendarResponse['conflicts'][number]): number {
  if (conflict.type === 'overload') return 0;
  if (conflict.severity === 'high') return 1;
  if (conflict.type === 'unavailable') return 2;
  if (conflict.type === 'multi_project') return 3;
  return 4;
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
  resourceCalendar,
  onRefreshResourceCalendar,
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
  const [clusterPmFilter, setClusterPmFilter] = useState('all');
  const [clusterDemoFilter, setClusterDemoFilter] = useState<'all' | 'yes' | 'no' | 'unknown'>('all');
  const [clusterKeyword, setClusterKeyword] = useState('');
  const [clusterFullscreen, setClusterFullscreen] = useState(false);
  const [selectedClusterProject, setSelectedClusterProject] = useState<ClusterRiskBoardItem | null>(null);
  const [clusterRefreshing, setClusterRefreshing] = useState(false);
  const [dashboardBoardTab, setDashboardBoardTab] = useState<'cluster' | 'roadmap' | 'resources'>('cluster');
  const [roadmapFullscreen, setRoadmapFullscreen] = useState(false);
  const [roadmapRefreshing, setRoadmapRefreshing] = useState(false);
  const [resourceRoleFilter, setResourceRoleFilter] = useState('all');
  const [resourceDepartmentFilter, setResourceDepartmentFilter] = useState('all');
  const [resourcePersonKeyword, setResourcePersonKeyword] = useState('');
  const [resourceProjectFilter, setResourceProjectFilter] = useState('all');
  const [resourceLoadFilter, setResourceLoadFilter] = useState<ResourceCalendarLoadFilter>('all');
  const [resourceRangeFilter, setResourceRangeFilter] = useState<ResourceCalendarRangeFilter>('next4Weeks');
  const [resourceFullscreen, setResourceFullscreen] = useState(false);
  const [resourceCalendarRefreshing, setResourceCalendarRefreshing] = useState(false);
  const [resourceTooltip, setResourceTooltip] = useState<ResourceCalendarTooltipState | null>(null);
  const canUsePortal = typeof window !== 'undefined' && typeof document !== 'undefined';

  useEffect(() => {
    if (!selectedClusterProject || typeof window === 'undefined') return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedClusterProject(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedClusterProject]);

  const clusterDetail = useMemo(() => {
    if (!selectedClusterProject) return null;
    const project = selectedClusterProject;
    const fields: ClusterDetailField[] = [
      clusterDetailDisplayField('重点项目', project.projectName),
      clusterDetailDisplayField('项目ID', project.projectId),
      clusterDetailDisplayField('项目1号位', project.ownerOne),
      clusterDetailDisplayField('PM', clusterProjectManager(project)),
      clusterDetailDisplayField('风险情况', project.riskLight),
      clusterDetailDisplayField('近期重点演示', keyDemoLabel(project.hasKeyDemo)),
      clusterDetailDisplayField('交付范围', project.deliveryScope, { wide: true }),
      clusterDetailDisplayField('周进展（PM）', project.weeklyProgress, { wide: true }),
      clusterDetailDisplayField('Daily风险求助（PM）', project.dailyRiskHelp, { tone: 'danger', wide: true }),
      clusterDetailDisplayField('最紧急的缺人情况（PM视角）', project.urgentStaffingGap, { tone: 'danger', wide: true }),
      clusterDetailDisplayField('质量状态与GAP-叶芳', project.qualityGap, { tone: 'action', wide: true })
    ];
    return {
      fields,
      urgency: clusterUrgency(project)
    };
  }, [selectedClusterProject]);

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
  const clusterPmOptions = useMemo(() => {
    return Array.from(new Set(clusterItems.map(clusterProjectManager).filter((name) => name && name !== '未填 PM')))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [clusterItems]);
  const filteredClusterItems = useMemo(() => {
    const keyword = clusterKeyword.trim().toLowerCase();
    return clusterItems.filter((item) => {
      if (clusterRiskFilter !== 'all' && item.riskLight !== clusterRiskFilter) return false;
      if (clusterPmFilter !== 'all' && clusterProjectManager(item) !== clusterPmFilter) return false;
      if (clusterDemoFilter === 'yes' && item.hasKeyDemo !== true) return false;
      if (clusterDemoFilter === 'no' && item.hasKeyDemo !== false) return false;
      if (clusterDemoFilter === 'unknown' && item.hasKeyDemo !== null) return false;
      if (!keyword) return true;
      const text = [
        item.projectName,
        item.projectId,
        item.ownerOne,
        item.pm,
        item.ownerPm,
        item.deliveryScope,
        item.weeklyProgress,
        item.dailyRiskHelp,
        item.urgentStaffingGap,
        item.riskResolution,
        item.qualityGap,
        item.qualityLevel
      ].join(' ').toLowerCase();
      return text.includes(keyword);
    });
  }, [clusterDemoFilter, clusterItems, clusterKeyword, clusterPmFilter, clusterRiskFilter]);

  const clusterSummary = useMemo(() => countFilteredClusterSummary(filteredClusterItems), [filteredClusterItems]);
  const clusterRiskGroups = useMemo(() => {
    return CLUSTER_RISK_ORDER.map((light) => ({
      light,
      items: filteredClusterItems.filter((item) => item.riskLight === light)
    })).filter((group) => group.items.length > 0 || (filteredClusterItems.length > 0 && group.light !== '未填'));
  }, [filteredClusterItems]);
  const clusterFocus = useMemo(() => ({
    urgent: filteredClusterItems.filter((item) => clusterUrgency(item).level === 4),
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

  async function refreshResourceCalendarBoard() {
    setResourceCalendarRefreshing(true);
    try {
      await onRefreshResourceCalendar();
    } finally {
      setResourceCalendarRefreshing(false);
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
        <ThemedSelect className="cluster-filter-select" value={clusterRiskFilter} onChange={(e) => setClusterRiskFilter(e.target.value as 'all' | ClusterRiskLight)}>
          <option value="all">全部风险灯</option>
          <option value="红灯">红灯</option>
          <option value="黄灯">黄灯</option>
          <option value="绿灯">绿灯</option>
          <option value="未填">未填</option>
        </ThemedSelect>
        <ThemedSelect className="cluster-filter-select" value={clusterPmFilter} onChange={(e) => setClusterPmFilter(e.target.value)}>
          <option value="all">全部项目经理</option>
          {clusterPmOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </ThemedSelect>
        <ThemedSelect className="cluster-filter-select" value={clusterDemoFilter} onChange={(e) => setClusterDemoFilter(e.target.value as 'all' | 'yes' | 'no' | 'unknown')}>
          <option value="all">全部演示状态</option>
          <option value="yes">近期重点演示</option>
          <option value="no">非近期演示</option>
          <option value="unknown">待确认</option>
        </ThemedSelect>
      </div>

      <div className="cluster-main-grid">
        <article className="cluster-health-map">
          <div className="section-title-row">
            <h3>项目健康地图</h3>
            <span className="muted">红灯优先排序</span>
          </div>
          {filteredClusterItems.length === 0 ? (
            <div className="cluster-empty">暂无匹配项目。请检查筛选条件或大看板数据源配置。</div>
          ) : (
            <div className="cluster-risk-group-list">
              {clusterRiskGroups.map((group) => (
                <section className={`cluster-risk-group ${riskToneClass(group.light)}`} key={group.light}>
                  <div className="cluster-risk-group-head">
                    <div>
                      <span className={`cluster-risk-badge ${riskToneClass(group.light)}`}>{group.light}</span>
                      <strong>{group.light === '红灯' ? '红灯项目' : group.light === '黄灯' ? '黄灯项目' : group.light === '绿灯' ? '绿灯项目' : '未填风险灯'}</strong>
                    </div>
                    <span className="cluster-risk-group-count">{group.items.length} 个项目</span>
                  </div>
                  {group.items.length === 0 ? (
                    <div className="cluster-group-empty">当前筛选下暂无{group.light}项目。</div>
                  ) : (
                    <div className="cluster-project-grid">
                      {group.items.map((item) => {
                        const urgency = clusterUrgency(item);
                        return (
                          <button
                            key={`${item.index}-${item.projectName}-${item.projectId}`}
                            className={`cluster-project-card ${riskToneClass(item.riskLight)}`}
                            type="button"
                            onClick={() => setSelectedClusterProject(item)}
                          >
                            <div className="cluster-project-title-row">
                              <strong>{item.projectName || '未命名项目'}</strong>
                              <span className="cluster-project-pm-tag">PM：{clusterProjectManager(item)}</span>
                            </div>
                            <div className="cluster-card-tags">
                              <span className={`cluster-risk-badge ${riskToneClass(item.riskLight)}`}>{item.riskLight}</span>
                              <span className={`cluster-urgency-badge ${urgency.className}`}>{urgency.icon} {urgency.label}</span>
                              <span>{keyDemoLabel(item.hasKeyDemo)}</span>
                            </div>
                            <div className="cluster-card-meta">
                              <span>项目ID：{item.projectId || '未立项'}</span>
                              <span>项目1号位：{item.ownerOne || '未填'}</span>
                            </div>
                            <div className="cluster-card-delivery-summary">
                              <span>交付范围</span>
                              <p>{excerpt(item.deliveryScope, 120)}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </article>

        <aside className="cluster-focus-panel">
          <h3>管理层关注</h3>
          {[
            ['特急项目', clusterFocus.urgent],
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
                              const detailRows = roadmapDetailRows(item);
                              if (xPercent === null) return null;
                              return (
                                <article className="roadmap-node" key={item.id} style={{ left: `${xPercent}%`, color }} tabIndex={0}>
                                  {item.hasFlag && <span className="roadmap-flag" />}
                                  <RoadmapCarIcon color={color} />
                                  <strong>{item.vehicleVersionName || item.milestoneName || '未命名节点'}</strong>
                                  {item.techDetail && <span className="roadmap-tech">({item.techDetail})</span>}
                                  <span className="roadmap-node-dot" style={{ background: color }} />
                                  <em>{roadmapDateLabel(item)}</em>
                                  <div className="roadmap-node-card">
                                    <div className="roadmap-node-card-head">
                                      <strong>{item.vehicleVersionName || item.milestoneName || '未命名节点'}</strong>
                                      {item.riskLevel && <span>{item.riskLevel}</span>}
                                    </div>
                                    <dl>
                                      {detailRows.map(([label, value]) => (
                                        <div key={label}>
                                          <dt>{label}</dt>
                                          <dd>{value}</dd>
                                        </div>
                                      ))}
                                    </dl>
                                  </div>
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

  const resourceRoleOptions = useMemo(() => {
    return Array.from(new Set((resourceCalendar?.people || []).map((person) => person.role.trim() || '未填角色'))).sort((a, b) => a.localeCompare(b));
  }, [resourceCalendar]);
  const resourceDepartmentOptions = useMemo(() => {
    return Array.from(new Set((resourceCalendar?.people || []).map((person) => person.department.trim() || '未填部门'))).sort((a, b) => a.localeCompare(b));
  }, [resourceCalendar]);
  const resourceProjectOptions = useMemo(() => {
    const projectMap = new Map<string, string>();
    for (const cell of resourceCalendar?.cells || []) {
      for (const project of cell.projects || []) {
        const key = project.projectId || project.projectName;
        if (key) projectMap.set(key, project.projectName || project.projectId || '未命名项目');
      }
    }
    return Array.from(projectMap.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [resourceCalendar]);
  const filteredResourceDays = useMemo(() => {
    return filterResourceDays(resourceCalendar?.range.days || [], resourceRangeFilter);
  }, [resourceCalendar, resourceRangeFilter]);
  const resourceDisplayColumns = useMemo(() => {
    return buildResourceColumns(filteredResourceDays, resourceRangeFilter);
  }, [filteredResourceDays, resourceRangeFilter]);
  const filteredResourceDaySet = useMemo(() => new Set(filteredResourceDays), [filteredResourceDays]);
  const resourceCellsInRange = useMemo(() => {
    return (resourceCalendar?.cells || []).filter((cell) => filteredResourceDaySet.has(cell.date));
  }, [filteredResourceDaySet, resourceCalendar]);
  const filteredResourcePeople = useMemo(() => {
    const keyword = resourcePersonKeyword.trim().toLowerCase();
    return (resourceCalendar?.people || []).filter((person) => {
      const personKey = person.personId || person.name;
      if (resourceRoleFilter !== 'all' && (person.role.trim() || '未填角色') !== resourceRoleFilter) return false;
      if (resourceDepartmentFilter !== 'all' && (person.department.trim() || '未填部门') !== resourceDepartmentFilter) return false;
      if (keyword) {
        const text = `${person.name} ${person.personId} ${person.department} ${person.role} ${person.location}`.toLowerCase();
        if (!text.includes(keyword)) return false;
      }
      const personCells = resourceCellsInRange.filter((cell) => cell.personId === personKey);
      if (resourceProjectFilter !== 'all' && !personCells.some((cell) => cell.projects.some((project) => (project.projectId || project.projectName) === resourceProjectFilter))) return false;
      if (resourceLoadFilter !== 'all' && !personCells.some((cell) => cell.status === resourceLoadFilter)) return false;
      return true;
    });
  }, [resourceCalendar, resourceCellsInRange, resourceDepartmentFilter, resourceLoadFilter, resourcePersonKeyword, resourceProjectFilter, resourceRoleFilter]);
  const filteredResourcePersonIds = useMemo(() => new Set(filteredResourcePeople.map((person) => person.personId || person.name)), [filteredResourcePeople]);
  const filteredResourceCells = useMemo(() => {
    return resourceCellsInRange.filter((cell) => filteredResourcePersonIds.has(cell.personId));
  }, [filteredResourcePersonIds, resourceCellsInRange]);
  const filteredResourceConflicts = useMemo(() => {
    return (resourceCalendar?.conflicts || [])
      .filter((conflict) => conflict.type !== 'multi_project')
      .filter((conflict) => filteredResourcePersonIds.has(conflict.personId) && filteredResourceDaySet.has(conflict.date))
      .sort((a, b) => resourceConflictRank(a) - resourceConflictRank(b) || a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  }, [filteredResourceDaySet, filteredResourcePersonIds, resourceCalendar]);
  const filteredResourceSummary = useMemo(() => {
    const personCapacityMap = new Map(filteredResourcePeople.map((person) => [person.personId || person.name, person.dailyCapacity || 1]));
    const availablePersonDays = roundResourceNumber(
      filteredResourceCells.reduce((sum, cell) => sum + (personCapacityMap.get(cell.personId) || 1) * cell.availablePercent / 100, 0)
    );
    const allocatedPersonDays = roundResourceNumber(filteredResourceCells.reduce((sum, cell) => sum + cell.allocatedDays, 0));
    return {
      peopleCount: filteredResourcePeople.length,
      availablePersonDays,
      allocatedPersonDays,
      utilizationRate: availablePersonDays > 0 ? roundResourceNumber((allocatedPersonDays / availablePersonDays) * 100) : 0,
      overloadedPeopleCount: new Set(filteredResourceCells.filter((cell) => cell.status === 'overloaded').map((cell) => cell.personId)).size,
      conflictCount: filteredResourceConflicts.length
    };
  }, [filteredResourceCells, filteredResourceConflicts, filteredResourcePeople]);

  function showResourceTooltip(target: HTMLElement, person: ResourceCalendarPerson, column: ResourceCalendarColumn, cell: ResourceCalendarDisplayCell) {
    const rect = target.getBoundingClientRect();
    const tooltipWidth = 280;
    const margin = 16;
    const x = Math.min(Math.max(rect.left + rect.width / 2, tooltipWidth / 2 + margin), window.innerWidth - tooltipWidth / 2 - margin);
    const hasRoomAbove = rect.top > 220;
    setResourceTooltip({
      x,
      y: hasRoomAbove ? rect.top - 12 : rect.bottom + 12,
      placement: hasRoomAbove ? 'top' : 'bottom',
      personName: person.name,
      label: column.tooltipLabel,
      mode: column.mode,
      cell
    });
  }

  function hideResourceTooltip() {
    setResourceTooltip(null);
  }

  const resourceBoard = (
    <section className={`resource-calendar-board ${resourceFullscreen ? 'resource-calendar-fullscreen' : ''}`}>
      <div className="resource-calendar-head">
        <div>
          <p className="cluster-board-eyebrow">Resource calendar</p>
          <h2>项目资源日历大看板</h2>
          <p className="muted">基于飞书人员资源、资源分配和人员日历表，展示{resourceRangeLabel(resourceRangeFilter)}资源占用与冲突。</p>
        </div>
        <div className="cluster-board-actions">
          <span className={`cluster-source-pill ${resourceCalendar?.source === 'feishu' ? 'ok' : 'warn'}`}>
            {resourceCalendar?.source === 'feishu' ? '飞书在线' : '数据源未就绪'}
          </span>
          <button className="btn" type="button" onClick={() => void refreshResourceCalendarBoard()} disabled={resourceCalendarRefreshing}>
            {resourceCalendarRefreshing ? '刷新中...' : '刷新'}
          </button>
          <button className="btn" type="button" onClick={() => setResourceFullscreen((prev) => !prev)}>
            {resourceFullscreen ? '退出全屏' : '全屏'}
          </button>
        </div>
      </div>

      {resourceCalendar?.error && (
        <div className="cluster-board-alert">
          {resourceCalendar.error}
        </div>
      )}

      <div className="resource-calendar-filters">
        <label>
          <span>人员搜索</span>
          <input
            value={resourcePersonKeyword}
            onChange={(e) => setResourcePersonKeyword(e.target.value)}
            placeholder="姓名 / ID / 部门 / 角色"
          />
        </label>
        <label>
          <span>按角色筛选</span>
          <select value={resourceRoleFilter} onChange={(e) => setResourceRoleFilter(e.target.value)}>
            <option value="all">全部角色</option>
            {resourceRoleOptions.map((role) => (
              <option value={role} key={role}>{role}</option>
            ))}
          </select>
        </label>
        <label>
          <span>按部门筛选</span>
          <select value={resourceDepartmentFilter} onChange={(e) => setResourceDepartmentFilter(e.target.value)}>
            <option value="all">全部部门</option>
            {resourceDepartmentOptions.map((department) => (
              <option value={department} key={department}>{department}</option>
            ))}
          </select>
        </label>
        <label>
          <span>按项目筛选</span>
          <select value={resourceProjectFilter} onChange={(e) => setResourceProjectFilter(e.target.value)}>
            <option value="all">全部项目</option>
            {resourceProjectOptions.map((project) => (
              <option value={project.value} key={project.value}>{project.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>负载状态</span>
          <select value={resourceLoadFilter} onChange={(e) => setResourceLoadFilter(e.target.value as ResourceCalendarLoadFilter)}>
            <option value="all">全部状态</option>
            <option value="idle">空闲</option>
            <option value="normal">正常负载</option>
            <option value="saturated">接近饱和</option>
            <option value="overloaded">过载</option>
            <option value="unavailable">不可用</option>
          </select>
        </label>
        <label>
          <span>视图范围</span>
          <select value={resourceRangeFilter} onChange={(e) => setResourceRangeFilter(e.target.value as ResourceCalendarRangeFilter)}>
            <option value="thisWeek">本周</option>
            <option value="thisMonth">本月</option>
            <option value="next4Weeks">未来 4 周</option>
            <option value="next8Weeks">未来 8 周</option>
          </select>
        </label>
        <p className="muted">
          当前显示 {filteredResourcePeople.length} / {resourceCalendar?.people.length || 0} 人，
          {resourceRangeFilter === 'next8Weeks' ? `${resourceDisplayColumns.length} 周` : `${filteredResourceDays.length} 天`}
        </p>
      </div>

      <div className="resource-kpis">
        <article>
          <span>总人数</span>
          <strong>{filteredResourceSummary.peopleCount}</strong>
        </article>
        <article>
          <span>可用人天</span>
          <strong>{filteredResourceSummary.availablePersonDays}</strong>
        </article>
        <article>
          <span>已分配人天</span>
          <strong>{filteredResourceSummary.allocatedPersonDays}</strong>
        </article>
        <article>
          <span>利用率</span>
          <strong>{filteredResourceSummary.utilizationRate}%</strong>
        </article>
        <article>
          <span>过载人数</span>
          <strong className="danger">{filteredResourceSummary.overloadedPeopleCount}</strong>
        </article>
        <article>
          <span>冲突数</span>
          <strong className="warn">{filteredResourceSummary.conflictCount}</strong>
        </article>
      </div>

      {filteredResourcePeople.length === 0 || filteredResourceDays.length === 0 ? (
        <div className="cluster-empty">暂无资源日历数据。请检查 RESOURCE_CALENDAR_* 配置或飞书字段映射。</div>
      ) : (
        <div className="resource-calendar-layout">
          <div className="resource-calendar-scroll">
            <div className="resource-calendar-grid" style={{ gridTemplateColumns: `220px repeat(${resourceDisplayColumns.length || 1}, minmax(${resourceRangeFilter === 'next8Weeks' ? 112 : 54}px, 1fr))` }}>
              <div className="resource-grid-sticky resource-grid-head">人员</div>
              {resourceDisplayColumns.map((column) => (
                <div className={`resource-grid-head ${column.mode === 'week' ? 'week' : ''}`} key={column.key}>
                  <strong>{column.label}</strong>
                </div>
              ))}
              {filteredResourcePeople.map((person) => (
                <div className="resource-person-row" key={person.personId || person.name}>
                  <div className="resource-person-cell resource-grid-sticky" key={`${person.personId}-person`}>
                    <strong>{person.name}</strong>
                    <span>{person.department} / {person.role}</span>
                    {(person.skillTags || person.isKeyResource || person.resourceStatus) && (
                      <span>{[person.skillTags, person.isKeyResource, person.resourceStatus].filter(Boolean).join(' / ')}</span>
                    )}
                  </div>
                  {resourceDisplayColumns.map((column) => {
                    const dailyCells = column.dates.flatMap((date) => {
                      const cell = resourceCellFor(person, date, filteredResourceCells);
                      return cell ? [cell] : [];
                    });
                    const displayCell = summarizeResourceCells(dailyCells);
                    const status = displayCell.status;
                    return (
                      <div
                        className={`resource-day-cell ${status}`}
                        key={`${person.personId}-${column.key}`}
                        tabIndex={0}
                        onMouseEnter={(e) => showResourceTooltip(e.currentTarget, person, column, displayCell)}
                        onMouseLeave={hideResourceTooltip}
                        onFocus={(e) => showResourceTooltip(e.currentTarget, person, column, displayCell)}
                        onBlur={hideResourceTooltip}
                      >
                        <strong>{displayCell.allocatedPercent}%</strong>
                        <span>{resourceCellStatusLabel(status)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <aside className="resource-conflicts">
            <h3>冲突与过载</h3>
            {filteredResourceConflicts.length === 0 ? (
              <p className="muted">暂无资源冲突。</p>
            ) : (
              filteredResourceConflicts.slice(0, 30).map((conflict, index) => (
                <article className={`resource-conflict ${conflict.severity}`} key={`${conflict.type}-${conflict.personId}-${conflict.date}-${index}`}>
                  <strong>{conflict.name} · {conflict.date.slice(5)}</strong>
                  <span>{conflict.message}</span>
                </article>
              ))
            )}
          </aside>
        </div>
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
        <button
          className={dashboardBoardTab === 'resources' ? 'active' : ''}
          type="button"
          onClick={() => setDashboardBoardTab('resources')}
        >
          项目资源日历
        </button>
      </div>

      {dashboardBoardTab === 'cluster' ? clusterBoard : dashboardBoardTab === 'roadmap' ? roadmapBoard : resourceBoard}

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
              <th>飞书 View ID</th>
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

                  <td
                    className={isEditing && projectEdit.editingField === 'feishuViewId' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'feishuViewId')}
                  >
                    {isEditing && projectEdit.editingField === 'feishuViewId' ? (
                      <input
                        data-project-edit={`${project.id}-feishuViewId`}
                        value={rowDraft.feishuViewId ?? ''}
                        onChange={(e) => projectEdit.updateDraft('feishuViewId', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.feishuViewId
                        ? <span title={rowDraft.feishuViewId ?? ''}>已配置</span>
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
              <input name="feishuViewId" placeholder="飞书多维表格 View ID（可选，用于同表不同视图）" />
            </form>
          </div>
        </div>,
        document.body
      )}
      </>
      )}

      {resourceTooltip && canUsePortal && createPortal(
        <div
          className={`resource-day-floating-tooltip ${resourceTooltip.placement}`}
          style={{
            left: resourceTooltip.x,
            top: resourceTooltip.y,
            transform: resourceTooltip.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
          }}
          role="tooltip"
        >
          <strong>{resourceTooltip.personName} · {resourceTooltip.label}</strong>
          <span>状态：{resourceCellStatusLabel(resourceTooltip.cell.status)}</span>
          <span>可用：{resourceTooltip.cell.availablePercent}%</span>
          <span>
            {resourceTooltip.mode === 'week' ? '周均分配' : '已分配'}：
            {resourceTooltip.cell.allocatedPercent}% / {resourceTooltip.cell.allocatedDays} 人天
          </span>
          {(resourceTooltip.cell.projects.length || 0) > 0 ? (
            <div>
              {resourceTooltip.cell.projects.map((project, index) => (
                <p key={`${project.projectId || project.projectName}-${index}`}>
                  {project.projectName || project.projectId || '未命名项目'}：{resourceTooltip.mode === 'week' ? '活跃日均 ' : ''}{project.allocationPercent}%
                  {project.role ? ` · ${project.role}` : ''}
                </p>
              ))}
            </div>
          ) : (
            <p>暂无项目分配</p>
          )}
        </div>,
        document.body
      )}

      {selectedClusterProject && clusterDetail && canUsePortal && createPortal(
        <div className="cluster-detail-backdrop" onClick={() => setSelectedClusterProject(null)}>
          <section className="cluster-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="集群风险项目详情">
            <div className="cluster-detail-head">
              <div>
                <div className="cluster-detail-badges">
                  <span className={`cluster-risk-badge ${riskToneClass(selectedClusterProject.riskLight)}`}>
                    {selectedClusterProject.riskLight}
                  </span>
                  <span className={`cluster-urgency-badge ${clusterDetail.urgency.className}`}>
                    {clusterDetail.urgency.icon} {clusterDetail.urgency.label}
                  </span>
                  {selectedClusterProject.needsEscalation && <span className="danger">需支持：{selectedClusterProject.needsEscalation}</span>}
                </div>
                <h3>{selectedClusterProject.projectName || '未命名项目'}</h3>
                <p className="muted">{selectedClusterProject.projectId || '未立项'} · 项目1号位：{selectedClusterProject.ownerOne || '未填'} · PM：{clusterProjectManager(selectedClusterProject)}</p>
              </div>
              <button className="btn" type="button" onClick={() => setSelectedClusterProject(null)}>关闭</button>
            </div>
            <section className="cluster-detail-section cluster-detail-modal-body">
              <div className="cluster-detail-section-head">
                <span>Project detail</span>
                <h4>项目详情</h4>
              </div>
              <div className="cluster-detail-data-grid">
                {clusterDetail.fields.map((field) => (
                  <ClusterDetailValue key={field.label} field={field} />
                ))}
              </div>
            </section>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
}
