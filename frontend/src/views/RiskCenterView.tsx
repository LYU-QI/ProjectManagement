import { useMemo } from 'react';
import type { RiskAlertsResponse } from '../types';
import usePersistentBoolean from '../hooks/usePersistentBoolean';

type Filters = {
  thresholdDays: number;
  progressThreshold: number;
  filterProject: string;
  filterStatus: string;
  filterAssignee: string;
  filterRisk: string;
  includeMilestones: boolean;
  autoNotify: boolean;
  enabled: boolean;
};

type Props = {
  data: RiskAlertsResponse | null;
  loading: boolean;
  error: string;
  message: string;
  filters: Filters;
  rules: Array<{
    id: number;
    key: string;
    type: string;
    name: string;
    enabled: boolean;
    thresholdDays: number;
    progressThreshold: number;
    includeMilestones: boolean;
    autoNotify: boolean;
    blockedValue?: string | null;
  }>;
  logs: Array<{ id: number; ruleId: number; action: string; note?: string | null; createdAt: string }>;
  projectOptions: string[];
  onChange: (next: Partial<Filters>) => void;
  onUpdateRule: (key: string, patch: Partial<{
    enabled: boolean;
    autoNotify: boolean;
    blockedValue?: string | null;
  }>) => void;
  onRefresh: () => void;
  onSaveRule: () => void;
  canWrite: boolean;
};

export default function RiskCenterView({
  data,
  loading,
  error,
  filters,
  rules,
  logs,
  projectOptions,
  onChange,
  onUpdateRule,
  onRefresh,
  onSaveRule,
  canWrite,
  message
}: Props) {
  const [filtersOpen, setFiltersOpen] = usePersistentBoolean('ui:risk-center:filtersOpen', true);
  const [compactTable, setCompactTable] = usePersistentBoolean('ui:risk-center:compactTable', false);
  const blockedRule = rules.find((item) => item.type === 'blocked');
  const overdueRule = rules.find((item) => item.type === 'overdue');
  const deadlineRule = rules.find((item) => item.type === 'deadline_progress');

  const metrics = useMemo(() => {
    const items = data?.items || [];
    return {
      total: data?.count ?? 0,
      blocked: items.filter((item) => (item.blocked || '').toLowerCase().includes('是')).length,
      overdue: items.filter((item) => item.overdue).length,
      highRisk: items.filter((item) => (item.riskLevel || '').includes('高')).length
    };
  }, [data]);

  return (
    <div>
      <section className="metrics-grid">
        <article className="metric-card">
          <p className="metric-label">风险任务总数</p>
          <p className="metric-value">{metrics.total}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">阻塞任务</p>
          <p className="metric-value warning">{metrics.blocked}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">已逾期任务</p>
          <p className="metric-value danger">{metrics.overdue}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">高风险等级</p>
          <p className="metric-value danger">{metrics.highRisk}</p>
        </article>
      </section>

      <div className="card compact-card" style={{ marginTop: 12 }}>
        <div className="section-title-row">
          <h3>风险过滤与执行</h3>
          <div className="panel-actions">
            <button className="btn" type="button" onClick={() => setFiltersOpen((prev) => !prev)}>
              {filtersOpen ? '收起筛选' : '展开筛选'}
            </button>
            <button className="btn" type="button" onClick={onRefresh} disabled={loading}>刷新</button>
            {canWrite && (
              <button className="btn btn-primary" type="button" onClick={onSaveRule} disabled={loading}>保存规则</button>
            )}
          </div>
        </div>

        {filtersOpen && (
          <div className="filters-grid">
          <div>
            <label>截止天数 ≤</label>
            <input type="number" min={1} value={filters.thresholdDays} onChange={(e) => onChange({ thresholdDays: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <label>进度 &lt;</label>
            <input type="number" min={0} max={100} value={filters.progressThreshold} onChange={(e) => onChange({ progressThreshold: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <label>所属项目</label>
            <select value={filters.filterProject} onChange={(e) => onChange({ filterProject: e.target.value })}>
              <option value="">全部</option>
              {projectOptions.map((project) => <option key={project} value={project}>{project}</option>)}
            </select>
          </div>
          <div>
            <label>状态</label>
            <select value={filters.filterStatus} onChange={(e) => onChange({ filterStatus: e.target.value })}>
              <option value="">全部</option>
              <option value="待办">待办</option>
              <option value="进行中">进行中</option>
              <option value="已完成">已完成</option>
            </select>
          </div>
          <div>
            <label>负责人</label>
            <input placeholder="姓名" value={filters.filterAssignee} onChange={(e) => onChange({ filterAssignee: e.target.value })} />
          </div>
          <div>
            <label>风险等级</label>
            <select value={filters.filterRisk} onChange={(e) => onChange({ filterRisk: e.target.value })}>
              <option value="">全部</option>
              <option value="低">低</option>
              <option value="中">中</option>
              <option value="高">高</option>
            </select>
          </div>
          <div>
            <label>包含里程碑</label>
            <select value={filters.includeMilestones ? '是' : '否'} onChange={(e) => onChange({ includeMilestones: e.target.value === '是' })}>
              <option value="否">否</option>
              <option value="是">是</option>
            </select>
          </div>
          <div>
            <label>规则启用</label>
            <select value={filters.enabled ? '是' : '否'} onChange={(e) => onChange({ enabled: e.target.value === '是' })}>
              <option value="是">是</option>
              <option value="否">否</option>
            </select>
          </div>
          </div>
        )}

        {message && <div style={{ marginTop: 10, color: 'var(--color-success)' }}>{message}</div>}
        {error && <div className="warn" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      <div className="dashboard-panels" style={{ marginTop: 12 }}>
        <div className="card compact-card">
          <div className="section-title-row">
            <h3>规则配置</h3>
            <span className="muted">多规则启停与通知控制</span>
          </div>
          <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div>
              <label>延期规则</label>
              <div className="muted">{deadlineRule?.name || '-'}</div>
              {deadlineRule && (
                <select value={deadlineRule.enabled ? '是' : '否'} onChange={(e) => onUpdateRule(deadlineRule.key, { enabled: e.target.value === '是' })} disabled={!canWrite}>
                  <option value="是">启用</option>
                  <option value="否">停用</option>
                </select>
              )}
            </div>
            <div>
              <label>阻塞规则</label>
              <div className="muted">{blockedRule?.name || '-'}</div>
              {blockedRule && (
                <select value={blockedRule.enabled ? '是' : '否'} onChange={(e) => onUpdateRule(blockedRule.key, { enabled: e.target.value === '是' })} disabled={!canWrite}>
                  <option value="是">启用</option>
                  <option value="否">停用</option>
                </select>
              )}
            </div>
            <div>
              <label>逾期规则</label>
              <div className="muted">{overdueRule?.name || '-'}</div>
              {overdueRule && (
                <select value={overdueRule.enabled ? '是' : '否'} onChange={(e) => onUpdateRule(overdueRule.key, { enabled: e.target.value === '是' })} disabled={!canWrite}>
                  <option value="是">启用</option>
                  <option value="否">停用</option>
                </select>
              )}
            </div>
            {blockedRule && (
              <div>
                <label>阻塞判定值</label>
                <input value={blockedRule.blockedValue ?? ''} onChange={(e) => onUpdateRule(blockedRule.key, { blockedValue: e.target.value })} disabled={!canWrite} />
              </div>
            )}
          </div>
        </div>

        <div className="card compact-card">
          <div className="section-title-row">
            <h3>规则变更日志</h3>
            <span className="muted">最近 {logs.length} 条</span>
          </div>
          <div style={{ maxHeight: 280, overflow: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th>时间</th><th>规则</th><th>动作</th><th>说明</th></tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const rule = rules.find((item) => item.id === log.ruleId);
                  return (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>{rule?.name || log.ruleId}</td>
                      <td>{log.action}</td>
                      <td style={{ whiteSpace: 'pre-wrap' }}>{log.note || '-'}</td>
                    </tr>
                  );
                })}
                {logs.length === 0 && (
                  <tr><td colSpan={4} className="muted">暂无规则变更日志</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="section-title-row">
          <h3>风险明细</h3>
          <div className="panel-actions">
            <span className="muted">共 {data?.count ?? 0} 条 · 生成时间 {data ? new Date(data.generatedAt).toLocaleString() : '-'}</span>
            <button className="btn" type="button" onClick={() => setCompactTable((prev) => !prev)}>
              {compactTable ? '标准密度' : '紧凑密度'}
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className={`table ${compactTable ? 'table-compact' : ''}`} style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>任务</th>
                <th>负责人</th>
                <th>所属项目</th>
                <th>截止日期</th>
                <th>剩余天数</th>
                <th>进度</th>
                <th>风险等级</th>
                <th>阻塞</th>
                <th>阻塞原因</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((item) => (
                <tr key={item.recordId}>
                  <td>{item.taskName || item.taskId}</td>
                  <td>{item.assignee || '-'}</td>
                  <td>{item.project || '-'}</td>
                  <td>{item.endDate || '-'}</td>
                  <td>{item.daysLeft ?? '-'}</td>
                  <td>{Number.isFinite(item.progress) ? `${item.progress.toFixed(0)}%` : '-'}</td>
                  <td>{item.riskLevel || '-'}</td>
                  <td>{item.blocked || '-'}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{item.blockedReason || '-'}</td>
                </tr>
              ))}
              {(data?.items?.length ?? 0) === 0 && !loading && (
                <tr><td colSpan={9} className="muted">暂无风险任务</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
