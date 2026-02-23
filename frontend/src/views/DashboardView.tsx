import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiPost } from '../api/client';
import type { DashboardOverview, ProjectItem } from '../types';

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
  overview: DashboardOverview | null;
  projects: ProjectItem[];
  selectedProjectIds: number[];
  onToggleProjectSelection: (id: number, checked: boolean) => void;
  onDeleteSelectedProjects: () => void;
  onSubmitProject: (e: FormEvent<HTMLFormElement>) => void;
  onDeleteProject: (project: ProjectItem) => void;
  projectEdit: InlineEditState<ProjectItem, number>;
  onSaveProject: (project: ProjectItem) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
};

/** 健康度颜色 */
function healthColor(score: number): string {
  if (score >= 80) return '#00ff88';
  if (score >= 60) return '#ffcc00';
  if (score >= 40) return '#ff8800';
  return '#ff3366';
}

/** 健康度标签 */
function healthLabel(score: number): string {
  if (score >= 80) return '优良';
  if (score >= 60) return '一般';
  if (score >= 40) return '警告';
  return '危险';
}

/** 格式化金额 */
function formatMoney(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return n.toLocaleString();
}

/** 健康度仪表盘组件 - 带动态动画 */
function GaugeChart({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const cx = size / 2;
  const cy = size / 2 + 2;
  const circumference = Math.PI * r;
  const filled = (score / 100) * circumference;
  const color = healthColor(score);
  const label = healthLabel(score);

  // 不同等级的状态图标
  const icon = score >= 80 ? '✓' : score >= 60 ? '!' : score >= 40 ? '⚠' : '✕';

  // 动态动画强度：分数越低，动画越剧烈
  const isDanger = score < 40;
  const isWarning = score >= 40 && score < 60;

  // 刻度线位置（0, 25, 50, 75, 100 对应半圆弧上的角度）
  const ticks = [0, 25, 50, 75, 100];

  // 生成 CSS keyframe id (避免全局冲突)
  const pulseId = `pulse-${score}`;

  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
      <defs>
        {/* 渐变弧线 */}
        <linearGradient id={`gauge-grad-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff3366" />
          <stop offset="40%" stopColor="#ff8800" />
          <stop offset="65%" stopColor="#ffcc00" />
          <stop offset="100%" stopColor="#00ff88" />
        </linearGradient>
        {/* 危险脉冲动画 */}
        {isDanger && (
          <style>{`
            @keyframes ${pulseId} {
              0%, 100% { opacity: 1; filter: drop-shadow(0 0 3px ${color}); }
              50% { opacity: 0.5; filter: drop-shadow(0 0 10px ${color}) drop-shadow(0 0 20px ${color}); }
            }
          `}</style>
        )}
        {/* 警告呼吸动画 */}
        {isWarning && (
          <style>{`
            @keyframes ${pulseId} {
              0%, 100% { filter: drop-shadow(0 0 3px ${color}); }
              50% { filter: drop-shadow(0 0 8px ${color}); }
            }
          `}</style>
        )}
      </defs>

      {/* 刻度线 */}
      {ticks.map((tick) => {
        const angle = Math.PI - (tick / 100) * Math.PI;
        const x1 = cx + (r - 2) * Math.cos(angle);
        const y1 = cy - (r - 2) * Math.sin(angle);
        const x2 = cx + (r + 4) * Math.cos(angle);
        const y2 = cy - (r + 4) * Math.sin(angle);
        return (
          <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        );
      })}

      {/* 背景弧（渐变底色） */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={7}
        strokeLinecap="round"
      />

      {/* 填充弧 - 带动态动画 */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        style={{
          filter: `drop-shadow(0 0 4px ${color})`,
          transition: 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease',
          animation: (isDanger || isWarning) ? `${pulseId} ${isDanger ? '1.2s' : '2.5s'} ease-in-out infinite` : 'none',
        }}
      />

      {/* 指针 */}
      {(() => {
        const angle = Math.PI - (score / 100) * Math.PI;
        const needleLen = r - 10;
        const nx = cx + needleLen * Math.cos(angle);
        const ny = cy - needleLen * Math.sin(angle);
        return (
          <>
            <circle cx={cx} cy={cy} r={3} fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
            <line x1={cx} y1={cy} x2={nx} y2={ny}
              stroke={color} strokeWidth={1.5} strokeLinecap="round"
              style={{ transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)', filter: `drop-shadow(0 0 2px ${color})` }}
            />
          </>
        );
      })()}

      {/* 分数 */}
      <text x={cx} y={cy - 12} textAnchor="middle" fill={color}
        fontSize={size * 0.2} fontFamily="Orbitron, monospace" fontWeight="bold"
        style={{ transition: 'fill 0.5s ease' }}>
        {score}
      </text>

      {/* 状态标签 */}
      <text x={cx} y={cy + 6} textAnchor="middle" fill={color} fontSize={9}
        fontWeight={isDanger ? 'bold' : 'normal'}
        style={{ transition: 'fill 0.5s ease' }}>
        {label}
      </text>

      {/* 危险时底部红色警示点 */}
      {isDanger && (
        <circle cx={cx} cy={cy + 14} r={2} fill="#ff3366"
          style={{ animation: `${pulseId} 1.2s ease-in-out infinite` }} />
      )}
    </svg>
  );
}

/** 迷你柱状图（预算 vs 实际） */
function BudgetBar({ budget, actual, width = 160 }: { budget: number; actual: number; width?: number }) {
  const max = Math.max(budget, actual, 1);
  const bw = (budget / max) * (width - 8);
  const aw = (actual / max) * (width - 8);
  const overBudget = actual > budget;
  const barH = 10;

  return (
    <svg width={width} height={38} viewBox={`0 0 ${width} 38`}>
      {/* 预算 */}
      <rect x={4} y={4} width={bw} height={barH} rx={2} fill="rgba(0,243,255,0.3)" stroke="rgba(0,243,255,0.5)" strokeWidth={0.5} />
      <text x={bw + 8} y={13} fill="rgba(0,243,255,0.7)" fontSize={8} fontFamily="monospace">{formatMoney(budget)}</text>
      {/* 实际 */}
      <rect x={4} y={20} width={aw} height={barH} rx={2} fill={overBudget ? 'rgba(255,51,102,0.5)' : 'rgba(0,255,136,0.4)'}
        stroke={overBudget ? 'rgba(255,51,102,0.7)' : 'rgba(0,255,136,0.6)'} strokeWidth={0.5} />
      <text x={aw + 8} y={29} fill={overBudget ? '#ff3366' : '#00ff88'} fontSize={8} fontFamily="monospace">{formatMoney(actual)}</text>
    </svg>
  );
}

/** 环形图（需求/成本分布） */
function DonutChart({ segments, size = 80 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>无数据</div>;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 16) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const currentOffset = offset;
        offset += dash;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={8}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-currentOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.6s ease', opacity: 0.8 }}
          />
        );
      })}
      <text x={cx} y={cy + 3} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={size * 0.18} fontFamily="Orbitron, monospace" fontWeight="bold">
        {total}
      </text>
    </svg>
  );
}

/** 水平风险条 */
function RiskBar({ blocked, total, width = 120 }: { blocked: number; total: number; width?: number }) {
  const pct = total > 0 ? (blocked / total) * 100 : 0;
  const color = pct > 30 ? '#ff3366' : pct > 10 ? '#ffcc00' : '#00ff88';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease', boxShadow: `0 0 6px ${color}` }} />
      </div>
      <span style={{ fontSize: 11, color, fontFamily: 'monospace' }}>{blocked}/{total}</span>
    </div>
  );
}

export default function DashboardView({
  canWrite,
  overview,
  projects,
  selectedProjectIds,
  onToggleProjectSelection,
  onDeleteSelectedProjects,
  onSubmitProject,
  onDeleteProject,
  projectEdit,
  onSaveProject,
  onInlineKeyDown
}: Props) {
  /** 汇总数据 */
  const stats = useMemo(() => {
    if (!overview) return null;
    const ps = overview.projects;
    const totalBudget = ps.reduce((s, p) => s + (p.budget ?? 0), 0);
    const totalActual = ps.reduce((s, p) => s + (p.actualCost ?? 0), 0);
    const totalBlocked = ps.reduce((s, p) => s + p.blockedTasks, 0);
    const totalReqs = ps.reduce((s, p) => s + p.requirementCount, 0);
    const avgHealth = ps.length > 0 ? Math.round(ps.reduce((s, p) => s + p.healthScore, 0) / ps.length) : 0;

    // 按健康度分类
    const healthDist = [
      { label: '优良(≥80)', value: ps.filter(p => p.healthScore >= 80).length, color: '#00ff88' },
      { label: '一般(60-79)', value: ps.filter(p => p.healthScore >= 60 && p.healthScore < 80).length, color: '#ffcc00' },
      { label: '警告(40-59)', value: ps.filter(p => p.healthScore >= 40 && p.healthScore < 60).length, color: '#ff8800' },
      { label: '危险(<40)', value: ps.filter(p => p.healthScore < 40).length, color: '#ff3366' },
    ];

    return { totalBudget, totalActual, totalBlocked, totalReqs, avgHealth, healthDist };
  }, [overview]);

  /** AI 洞察中心状态 */
  const [aiSummary, setAiSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [riskPredict, setRiskPredict] = useState('');
  const [predictLoading, setPredictLoading] = useState(false);

  async function handleGetAiSummary() {
    setSummaryLoading(true);
    try {
      // 这里的 projectId 取第一个，或者是根据业务习惯传入 selectedProjectIds[0]
      const res = await apiPost<{ report: string }>('/ai/dashboard/summary', {
        projectId: selectedProjectIds.length === 1 ? selectedProjectIds[0] : undefined
      });
      setAiSummary(res.report);
    } catch (err: any) {
      setAiSummary(`获取失败: ${err.message}`);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleGetRiskPredict() {
    setPredictLoading(true);
    try {
      const res = await apiPost<{ report: string }>('/ai/risks/predict', {
        projectId: selectedProjectIds.length === 1 ? selectedProjectIds[0] : undefined
      });
      setRiskPredict(res.report);
    } catch (err: any) {
      setRiskPredict(`获取失败: ${err.message}`);
    } finally {
      setPredictLoading(false);
    }
  }

  return (
    <div>
      {/* 新增项目表单 */}
      {canWrite && (
        <form className="form" onSubmit={onSubmitProject} style={{ marginBottom: 12 }}>
          <input name="name" placeholder="项目名称" required />
          <input name="budget" type="number" step="0.01" placeholder="预算" required />
          <input name="startDate" type="date" />
          <input name="endDate" type="date" />
          <button className="btn" type="submit">新增项目</button>
        </form>
      )}

      {/* ===== 统计卡片行 ===== */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <div className="card" style={{ textAlign: 'center', borderTop: '2px solid var(--neon-blue)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: 6 }}>项目总数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--neon-blue)', fontFamily: 'Orbitron' }}>{overview?.summary.projectCount ?? 0}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderTop: '2px solid #00ff88' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: 6 }}>需求总数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#00ff88', fontFamily: 'Orbitron' }}>{overview?.summary.requirementCount ?? 0}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderTop: '2px solid #ff3366' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: 6 }}>高风险项目</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ff3366', fontFamily: 'Orbitron' }}>{overview?.summary.riskProjectCount ?? 0}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderTop: '2px solid #ffcc00' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: 6 }}>阻塞任务</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ffcc00', fontFamily: 'Orbitron' }}>{stats?.totalBlocked ?? 0}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderTop: `2px solid ${healthColor(stats?.avgHealth ?? 0)}` }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: 6 }}>平均健康度</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: healthColor(stats?.avgHealth ?? 0), fontFamily: 'Orbitron' }}>{stats?.avgHealth ?? 0}</div>
        </div>
      </div>

      {/* ===== AI 智能洞察面板 (新特性) ===== */}
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        {/* 执行简报卡片 */}
        <div className="card" style={{ borderLeft: '3px solid #b44dff', position: 'relative', minHeight: 180 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 13, color: '#b44dff', letterSpacing: 1 }}>✨ AI 执行简报</h3>
            <button
              className="btn"
              style={{ fontSize: 10, padding: '3px 8px', borderColor: '#b44dff', color: '#b44dff' }}
              onClick={handleGetAiSummary}
              disabled={summaryLoading}
            >
              {summaryLoading ? '⌛ 解析中' : '刷新分析'}
            </button>
          </div>
          <div style={{ fontSize: 13, lineHeight: '1.6', color: 'rgba(255,255,255,0.85)' }}>
            {aiSummary ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiSummary}</ReactMarkdown>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                {summaryLoading ? 'AI 正在阅读项目动态，请稍候...' : '点击“刷新分析”获取针对当前数据的洞察总结'}
              </div>
            )}
          </div>
        </div>

        {/* 风险雷达卡片 */}
        <div className="card" style={{ borderLeft: '3px solid #ff8800', position: 'relative', minHeight: 180 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 13, color: '#ff8800', letterSpacing: 1 }}>🛡️ 风险走向预测</h3>
            <button
              className="btn"
              style={{ fontSize: 10, padding: '3px 8px', borderColor: '#ff8800', color: '#ff8800' }}
              onClick={handleGetRiskPredict}
              disabled={predictLoading}
            >
              {predictLoading ? '⌛ 预测中' : '开始预测'}
            </button>
          </div>
          <div style={{ fontSize: 13, lineHeight: '1.6', color: 'rgba(255,255,255,0.85)' }}>
            {riskPredict ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{riskPredict}</ReactMarkdown>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                {predictLoading ? '正在基于历史数据进行量化推演...' : 'AI 专家将根据任务与变更历史预测未来风险点'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== 图表区：健康度分布 + 预算概览 ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        {/* 健康度分布饼图 */}
        <div className="card">
          <h3 style={{ margin: '0 0 14px', fontSize: 13, letterSpacing: 1, borderBottom: '1px solid rgba(0,243,255,0.15)', paddingBottom: 8 }}>
            📊 项目健康度分布
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <DonutChart segments={stats?.healthDist ?? []} size={100} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(stats?.healthDist ?? []).map((seg) => (
                <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, boxShadow: `0 0 4px ${seg.color}` }} />
                  <span style={{ color: 'var(--text-muted)' }}>{seg.label}</span>
                  <span style={{ color: seg.color, fontFamily: 'Orbitron', fontWeight: 600 }}>{seg.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 预算概览 */}
        <div className="card">
          <h3 style={{ margin: '0 0 14px', fontSize: 13, letterSpacing: 1, borderBottom: '1px solid rgba(0,243,255,0.15)', paddingBottom: 8 }}>
            💰 预算总览
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>总预算</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-blue)', fontFamily: 'Orbitron' }}>¥{formatMoney(stats?.totalBudget ?? 0)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>总实际</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: (stats?.totalActual ?? 0) > (stats?.totalBudget ?? 0) ? '#ff3366' : '#00ff88', fontFamily: 'Orbitron' }}>
                  ¥{formatMoney(stats?.totalActual ?? 0)}
                </span>
              </div>
              {/* 预算使用进度条 */}
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                  预算使用率 {stats?.totalBudget ? Math.round(((stats.totalActual) / stats.totalBudget) * 100) : 0}%
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(stats?.totalBudget ? ((stats.totalActual) / stats.totalBudget) * 100 : 0, 100)}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: (stats?.totalActual ?? 0) > (stats?.totalBudget ?? 0)
                      ? 'linear-gradient(90deg, #ff3366, #ff6699)'
                      : 'linear-gradient(90deg, #00ff88, #00ccff)',
                    transition: 'width 0.8s ease',
                    boxShadow: '0 0 8px rgba(0,255,136,0.3)',
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 项目详情卡片（带图表） ===== */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 13, letterSpacing: 1, borderBottom: '1px solid rgba(0,243,255,0.15)', paddingBottom: 8 }}>
          🎯 项目健康度矩阵
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {overview?.projects.map((p) => (
            <div key={p.projectId} style={{
              padding: '14px 16px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 6,
              border: `1px solid ${healthColor(p.healthScore)}22`,
              borderLeft: `3px solid ${healthColor(p.healthScore)}`,
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>{p.projectName}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>#{p.projectId} · 需求 {p.requirementCount}</div>
                </div>
                <GaugeChart score={p.healthScore} size={70} />
              </div>

              {/* 预算对比 */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>预算 vs 实际</div>
                <BudgetBar budget={p.budget ?? 0} actual={p.actualCost ?? 0} width={220} />
              </div>

              {/* 风险指标 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>阻塞任务</div>
                  <RiskBar blocked={p.blockedTasks} total={Math.max(p.requirementCount, p.blockedTasks + 1)} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>预算偏差</div>
                  <span style={{
                    fontSize: 14,
                    fontFamily: 'Orbitron, monospace',
                    fontWeight: 700,
                    color: p.varianceRate > 10 ? '#ff3366' : p.varianceRate > 0 ? '#ffcc00' : '#00ff88',
                  }}>
                    {p.varianceRate > 0 ? '+' : ''}{p.varianceRate}%
                  </span>
                </div>
              </div>
            </div>
          ))}
          {(!overview?.projects || overview.projects.length === 0) && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
              暂无项目数据
            </div>
          )}
        </div>
      </div>

      {/* ===== 项目管理表格 ===== */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>项目管理</h3>
          {canWrite && (
            <button className="btn" type="button" disabled={selectedProjectIds.length === 0} onClick={onDeleteSelectedProjects}>
              批量删除 ({selectedProjectIds.length})
            </button>
          )}
        </div>
        <table className="table">
          <thead>
            <tr>
              {canWrite && (
                <th>
                  <input
                    type="checkbox"
                    checked={projects.length > 0 && selectedProjectIds.length === projects.length}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      projects.forEach((project) => onToggleProjectSelection(project.id, checked));
                    }}
                  />
                </th>
              )}
              <th>ID</th>
              <th>名称</th>
              <th>预算</th>
              <th>开始</th>
              <th>结束</th>
              {canWrite && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
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
                  <td>{project.id}</td>
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
                  {canWrite && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      {isEditing && isDirty ? (
                        <>
                          <button className="btn" type="button" disabled={!isDirty} onClick={() => onSaveProject(project)}>保存</button>
                          <button className="btn" type="button" onClick={projectEdit.cancel}>取消</button>
                        </>
                      ) : (
                        <button className="btn" type="button" onClick={() => onDeleteProject(project)}>删除</button>
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
