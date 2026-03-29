import { useEffect, useState } from 'react';
import { getEfficiency } from '../api/efficiency';
import type { EfficiencyData } from '../types';

type Props = {
  projectId: number | null;
  projectName: string;
};

function fmtMoney(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function RateBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="eff-rate-row">
      <span className="eff-rate-label">{label}</span>
      <div className="eff-rate-bar">
        <div className={`eff-rate-fill ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="eff-rate-value">{value}%</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {sub && <p className="muted" style={{ fontSize: '0.75rem' }}>{sub}</p>}
    </article>
  );
}

export default function EfficiencyView({ projectId, projectName }: Props) {
  const [data, setData] = useState<EfficiencyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    getEfficiency(projectId)
      .then((res) => setData(res))
      .catch((err: Error) => setError(err.message || '加载效能数据失败'))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="card">
        <p className="muted">请先选择项目以查看效能数据。</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <p className="muted">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="warn">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <p className="muted">暂无效能数据。</p>
      </div>
    );
  }

  const m = data.metrics;
  const totalBug = m.bugCount;
  const bugResolvedPct = totalBug > 0 ? Math.round((m.resolvedBugCount / totalBug) * 100) : 0;

  return (
    <div>
      <section className="metrics-grid">
        <StatCard label="需求总数" value={m.requirementCount} />
        <StatCard label="Bug 总数" value={m.bugCount} />
        <StatCard label="工作项总数" value={m.workItemCount} />
        <StatCard label="总成本" value={`¥${fmtMoney(m.totalCost)}`} sub="人力+外包+云" />
      </section>

      <section className="dashboard-panels dashboard-panels-gap">
        {/* Bug Stats */}
        <article className="card compact-card">
          <h3>Bug 统计</h3>
          <div className="eff-bug-grid">
            <div className="eff-bug-item">
              <span className="eff-bug-num">{m.bugCount}</span>
              <span className="muted">总数</span>
            </div>
            <div className="eff-bug-item">
              <span className="eff-bug-num danger">{m.openBugCount}</span>
              <span className="muted">待处理</span>
            </div>
            <div className="eff-bug-item">
              <span className="eff-bug-num good">{m.resolvedBugCount}</span>
              <span className="muted">已解决</span>
            </div>
            <div className="eff-bug-item">
              <span className="eff-bug-num">{m.avgResolutionDays}</span>
              <span className="muted">平均解决天数</span>
            </div>
          </div>
          <RateBar value={bugResolvedPct} label="Bug 解决率" color="good" />
          <div className="eff-bug-bar-segments">
            <div className="eff-seg-row">
              <span className="muted">未解决</span>
              <div className="eff-seg-track">
                <div className="eff-seg-fill danger" style={{ width: `${totalBug > 0 ? (m.openBugCount / totalBug) * 100 : 0}%` }} />
              </div>
              <span>{m.openBugCount}</span>
            </div>
            <div className="eff-seg-row">
              <span className="muted">已解决</span>
              <div className="eff-seg-track">
                <div className="eff-seg-fill good" style={{ width: `${totalBug > 0 ? (m.resolvedBugCount / totalBug) * 100 : 0}%` }} />
              </div>
              <span>{m.resolvedBugCount}</span>
            </div>
          </div>
        </article>

        {/* Requirement Stats */}
        <article className="card compact-card">
          <h3>需求统计</h3>
          <div className="eff-req-grid">
            <div className="eff-bug-item">
              <span className="eff-bug-num">{m.requirementCount}</span>
              <span className="muted">总数</span>
            </div>
          </div>
          <RateBar value={m.approvedRate} label="通过率" color="good" />
          <RateBar value={m.doneRate} label="完成率" color="mid" />
        </article>

        {/* Cost Breakdown */}
        <article className="card compact-card">
          <h3>成本构成</h3>
          <div className="eff-cost-total">
            <span className="metric-label">总成本</span>
            <span className="metric-value">¥{fmtMoney(m.totalCost)}</span>
          </div>
          <div className="eff-cost-bars">
            <div className="eff-cost-row">
              <span className="eff-cost-label">人力成本</span>
              <div className="eff-cost-track">
                <div className="eff-cost-fill labor" style={{ width: `${m.totalCost > 0 ? (m.laborCost / m.totalCost) * 100 : 0}%` }} />
              </div>
              <span className="eff-cost-val">¥{fmtMoney(m.laborCost)}</span>
            </div>
            <div className="eff-cost-row">
              <span className="eff-cost-label">外包成本</span>
              <div className="eff-cost-track">
                <div className="eff-cost-fill outsource" style={{ width: `${m.totalCost > 0 ? (m.outsourceCost / m.totalCost) * 100 : 0}%` }} />
              </div>
              <span className="eff-cost-val">¥{fmtMoney(m.outsourceCost)}</span>
            </div>
            <div className="eff-cost-row">
              <span className="eff-cost-label">云资源</span>
              <div className="eff-cost-track">
                <div className="eff-cost-fill cloud" style={{ width: `${m.totalCost > 0 ? (m.cloudCost / m.totalCost) * 100 : 0}%` }} />
              </div>
              <span className="eff-cost-val">¥{fmtMoney(m.cloudCost)}</span>
            </div>
          </div>
        </article>

        {/* Work Item + Schedule */}
        <article className="card compact-card">
          <h3>工作项与进度</h3>
          <div className="eff-wi-grid">
            <div className="eff-bug-item">
              <span className="eff-bug-num">{m.workItemCount}</span>
              <span className="muted">工作项总数</span>
            </div>
            <div className="eff-bug-item">
              <span className="eff-bug-num good">{m.doneWorkItemRate}%</span>
              <span className="muted">完成率</span>
            </div>
          </div>
          <RateBar value={m.doneWorkItemRate} label="工作项完成率" color="good" />
          <RateBar value={m.onTimeDeliveryRate} label="准时交付率" color={m.onTimeDeliveryRate >= 80 ? 'good' : 'mid'} />
        </article>
      </section>
    </div>
  );
}
