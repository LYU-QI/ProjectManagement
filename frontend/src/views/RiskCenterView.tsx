import type { RiskAlertsResponse } from '../types';

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
  const blockedRule = rules.find((item) => item.type === 'blocked');
  const overdueRule = rules.find((item) => item.type === 'overdue');
  const deadlineRule = rules.find((item) => item.type === 'deadline_progress');

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="form" style={{ gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))' }}>
          <div>
            <label>截止天数 ≤</label>
            <input
              type="number"
              min={1}
              value={filters.thresholdDays}
              onChange={(e) => onChange({ thresholdDays: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label>进度 &lt;</label>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.progressThreshold}
              onChange={(e) => onChange({ progressThreshold: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label>所属项目</label>
            <select value={filters.filterProject} onChange={(e) => onChange({ filterProject: e.target.value })}>
              <option value="">全部</option>
              {projectOptions.map((project) => (
                <option key={project} value={project}>{project}</option>
              ))}
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
            <input
              placeholder="姓名"
              value={filters.filterAssignee}
              onChange={(e) => onChange({ filterAssignee: e.target.value })}
            />
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
          <div>
            <label>自动通知</label>
            <select value={filters.autoNotify ? '是' : '否'} onChange={(e) => onChange({ autoNotify: e.target.value === '是' })}>
              <option value="是">是</option>
              <option value="否">否</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="button" onClick={onRefresh} disabled={loading}>刷新</button>
              {canWrite && (
                <button className="btn" type="button" onClick={onSaveRule} disabled={loading}>保存规则</button>
              )}
            </div>
          </div>
        </div>
        {message && <div style={{ marginTop: 10, color: 'var(--neon-green)' }}>{message}</div>}
        {data && (
          <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>
            规则：{data.rules.map((rule) => rule.description).join(' / ')}｜生成时间：{new Date(data.generatedAt).toLocaleString()}
          </div>
        )}
        {error && <div className="warn" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>规则配置（多规则）</h3>
        <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <label>延期规则启用</label>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{deadlineRule?.name}</div>
            {deadlineRule && (
              <select
                value={deadlineRule.enabled ? '是' : '否'}
                onChange={(e) => onUpdateRule(deadlineRule.key, { enabled: e.target.value === '是' })}
                disabled={!canWrite}
              >
                <option value="是">是</option>
                <option value="否">否</option>
              </select>
            )}
          </div>
          <div>
            <label>阻塞规则启用</label>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{blockedRule?.name}</div>
            {blockedRule && (
              <select
                value={blockedRule.enabled ? '是' : '否'}
                onChange={(e) => onUpdateRule(blockedRule.key, { enabled: e.target.value === '是' })}
                disabled={!canWrite}
              >
                <option value="是">是</option>
                <option value="否">否</option>
              </select>
            )}
          </div>
          <div>
            <label>逾期规则启用</label>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{overdueRule?.name}</div>
            {overdueRule && (
              <select
                value={overdueRule.enabled ? '是' : '否'}
                onChange={(e) => onUpdateRule(overdueRule.key, { enabled: e.target.value === '是' })}
                disabled={!canWrite}
              >
                <option value="是">是</option>
                <option value="否">否</option>
              </select>
            )}
          </div>
          {blockedRule && (
            <div>
              <label>阻塞判定值</label>
              <input
                value={blockedRule.blockedValue ?? ''}
                onChange={(e) => onUpdateRule(blockedRule.key, { blockedValue: e.target.value })}
                disabled={!canWrite}
              />
            </div>
          )}
          {blockedRule && (
            <div>
              <label>阻塞通知</label>
              <select
                value={blockedRule.autoNotify ? '是' : '否'}
                onChange={(e) => onUpdateRule(blockedRule.key, { autoNotify: e.target.value === '是' })}
                disabled={!canWrite}
              >
                <option value="是">是</option>
                <option value="否">否</option>
              </select>
            </div>
          )}
          {overdueRule && (
            <div>
              <label>逾期通知</label>
              <select
                value={overdueRule.autoNotify ? '是' : '否'}
                onChange={(e) => onUpdateRule(overdueRule.key, { autoNotify: e.target.value === '是' })}
                disabled={!canWrite}
              >
                <option value="是">是</option>
                <option value="否">否</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>风险清单</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>共 {data?.count ?? 0} 条</span>
        </div>
        <table className="table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>任务</th>
              <th>负责人</th>
              <th>所属项目</th>
              <th>截止日期</th>
              <th>剩余天数</th>
              <th>进度</th>
              <th>风险等级</th>
              <th>是否阻塞</th>
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
              <tr>
                <td colSpan={9} style={{ color: 'var(--text-muted)' }}>暂无风险任务</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>规则变更日志</h3>
        <table className="table">
          <thead><tr><th>时间</th><th>规则</th><th>动作</th><th>说明</th></tr></thead>
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
              <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>暂无规则变更日志</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
