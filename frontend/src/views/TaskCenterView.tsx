import { Fragment, useEffect, useMemo, useState } from 'react';
import { getTaskCenterStats, listTaskCenterItems, retryTaskCenterItem, TaskCenterItem, TaskCenterSeverity, TaskCenterSource, TaskCenterStats, TaskCenterStatus } from '../api/taskCenter';
import useEventStream from '../hooks/useEventStream';
import ScopeContextBar from '../components/ScopeContextBar';
import type { ViewKey } from '../components/AstraeaLayout';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import AsyncStatePanel from '../components/AsyncStatePanel';
import TableToolbar from '../components/TableToolbar';

type Props = {
  orgName?: string | null;
  projectId?: number | null;
  projectName?: string;
  onNavigate?: (view: ViewKey) => void;
};

type RetryResult = {
  id: string;
  title: string;
  sourceLabel: string;
  status: 'success' | 'failed';
  errorCode?: string | null;
  message: string;
  at: string;
};

const SOURCE_OPTIONS: Array<{ value: TaskCenterSource | 'all'; label: string }> = [
  { value: 'all', label: '全部来源' },
  { value: 'pm_assistant', label: 'PM 助手' },
  { value: 'automation', label: '自动化规则' },
  { value: 'feishu', label: '飞书集成' },
  { value: 'ai_chat', label: 'AI 对话' }
];

const STATUS_OPTIONS: Array<{ value: TaskCenterStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
  { value: 'dry-run', label: '演练' },
  { value: 'skipped', label: '跳过' },
  { value: 'unknown', label: '未归类' }
];

const SEVERITY_OPTIONS: Array<{ value: TaskCenterSeverity | 'all'; label: string }> = [
  { value: 'all', label: '全部严重级别' },
  { value: 'critical', label: '高风险' },
  { value: 'warning', label: '需关注' },
  { value: 'info', label: '正常' }
];

const SOURCE_HEALTH_META: Array<{ key: TaskCenterSource; label: string }> = [
  { key: 'pm_assistant', label: 'PM 助手' },
  { key: 'automation', label: '自动化规则' },
  { key: 'feishu', label: '飞书集成' },
  { key: 'ai_chat', label: 'AI 对话' }
];

export default function TaskCenterView({ orgName, projectId, projectName, onNavigate }: Props) {
  const setRecoveryContext = useWorkspaceStore((state) => state.setRecoveryContext);
  const [items, setItems] = useState<TaskCenterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<TaskCenterSource | 'all'>('all');
  const [status, setStatus] = useState<TaskCenterStatus | 'all'>('all');
  const [severity, setSeverity] = useState<TaskCenterSeverity | 'all'>('all');
  const [errorCodeQuery, setErrorCodeQuery] = useState('');
  const [limit, setLimit] = useState(60);
  const [keyword, setKeyword] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [lastRetryMessage, setLastRetryMessage] = useState('');
  const [recentRetryResults, setRecentRetryResults] = useState<RetryResult[]>([]);
  const [stats, setStats] = useState<TaskCenterStats | null>(null);
  const [statsDays, setStatsDays] = useState(7);

  async function loadItems() {
    setLoading(true);
    setError('');
    try {
      const res = await listTaskCenterItems({
        projectId,
        source,
        status,
        severity,
        errorCode: errorCodeQuery.trim(),
        limit
      });
      setItems(res);
    } catch (err: any) {
      setError(err.message || '加载任务中心失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const res = await getTaskCenterStats({
        projectId,
        source,
        days: statsDays
      });
      setStats(res);
    } catch {
      setStats(null);
    }
  }

  useEffect(() => {
    void loadItems();
  }, [projectId, source, status, severity, errorCodeQuery, limit]);

  useEffect(() => {
    void loadStats();
  }, [projectId, source, statsDays]);

  useEventStream({
    enabled: true,
    eventTypes: [
      'pm_assistant.run.completed',
      'automation.rule.executed',
      'feishu.records.changed'
    ],
    onEvent: (event) => {
      if (event.projectId && projectId && event.projectId !== projectId) return;
      void loadItems();
      void loadStats();
    }
  });

  const filteredItems = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const haystack = [
        item.sourceLabel,
        item.title,
        item.summary,
        item.errorCode || '',
        item.errorCategory || '',
        item.trigger || '',
        item.actorName || '',
        item.projectName || ''
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [items, keyword]);

  const counts = stats?.bySource ?? { pm_assistant: 0, automation: 0, feishu: 0, ai_chat: 0 };
  const statusCounts = stats?.byStatus ?? { success: 0, failed: 0, 'dry-run': 0, skipped: 0, unknown: 0 };
  const sourceStatus = stats?.bySourceStatus ?? {
    pm_assistant: { success: 0, failed: 0, 'dry-run': 0, skipped: 0, unknown: 0 },
    automation: { success: 0, failed: 0, 'dry-run': 0, skipped: 0, unknown: 0 },
    feishu: { success: 0, failed: 0, 'dry-run': 0, skipped: 0, unknown: 0 },
    ai_chat: { success: 0, failed: 0, 'dry-run': 0, skipped: 0, unknown: 0 }
  };
  const successRate = `${stats?.successRate ?? 0}%`;
  const topErrorCodes = stats?.topErrorCodes ?? [];
  const recentFailures = stats?.recentFailures ?? [];
  const weeklyTrend = stats?.trend ?? [];
  const sourceHealthCards = useMemo(() => {
    return SOURCE_HEALTH_META.map((sourceItem) => {
      const bucket = sourceStatus[sourceItem.key];
      const total = bucket.success + bucket.failed + bucket['dry-run'] + bucket.skipped + bucket.unknown;
      const base = bucket.success + bucket.failed + bucket['dry-run'] + bucket.skipped;
      const rate = base > 0 ? Math.round((bucket.success / base) * 100) : 0;
      const health = total === 0
        ? '无数据'
        : bucket.failed > 0
          ? rate >= 80 ? '关注' : '告警'
          : rate >= 95
            ? '健康'
            : '稳定';
      return {
        ...sourceItem,
        total,
        failed: bucket.failed,
        rate,
        health
      };
    });
  }, [sourceStatus]);

  function getStatusTone(value: TaskCenterStatus) {
    if (value === 'failed') return 'var(--color-danger)';
    if (value === 'success') return 'var(--color-success)';
    if (value === 'dry-run') return 'var(--color-warning)';
    if (value === 'skipped') return 'var(--color-text-muted)';
    return 'var(--color-primary)';
  }

  function getSeverityLabel(item: TaskCenterItem) {
    if (item.severity === 'critical') return '高风险';
    if (item.severity === 'warning') return '需关注';
    return '正常';
  }

  function getRetryLabel(item: TaskCenterItem) {
    if (item.source === 'pm_assistant') return '重新执行';
    if (item.source === 'automation') return '重新试跑';
    return '重试';
  }

  function sourceFromLabel(sourceLabel: string): TaskCenterSource {
    if (sourceLabel === '飞书集成') return 'feishu';
    if (sourceLabel === 'PM 助手') return 'pm_assistant';
    if (sourceLabel === '自动化规则') return 'automation';
    return 'ai_chat';
  }

  function getRecoveryView(item: Pick<TaskCenterItem, 'source' | 'errorCode'>): ViewKey | null {
    if (item.errorCode?.startsWith('TC-FEI')) return 'feishu';
    if (item.errorCode?.startsWith('TC-PMA')) return 'pm-assistant';
    if (item.errorCode?.startsWith('TC-AUT')) return 'automation';
    if (item.errorCode?.startsWith('TC-AI-401')) return 'settings';
    if (item.source === 'feishu') return 'feishu';
    if (item.source === 'pm_assistant') return 'pm-assistant';
    if (item.source === 'automation') return 'automation';
    return null;
  }

  function navigateToRecovery(item: Pick<TaskCenterItem, 'source' | 'errorCode' | 'severity' | 'recoveryEntry'>) {
    const nextView = getRecoveryView(item);
    if (!nextView || !onNavigate) return;
    setRecoveryContext({
      from: 'task-center',
      source: item.source,
      errorCode: item.errorCode ?? null,
      severity: item.severity ?? null,
      recoveryEntry: item.recoveryEntry ?? null,
      projectId: projectId ?? null,
      projectName: projectName ?? null
    });
    onNavigate(nextView);
  }

  async function retryItem(item: TaskCenterItem) {
    if (!item.retryable || !item.retryMeta) return;
    setRetryingId(item.id);
    setError('');
    setLastRetryMessage('');
    const pushRetryResult = (result: RetryResult) => {
      setRecentRetryResults((prev) => [result, ...prev].slice(0, 5));
    };
    try {
      const result = await retryTaskCenterItem(item.source, item.retryMeta);
      setLastRetryMessage(`${result.message}${result.errorCode ? `（${result.errorCode}）` : ''}`);
      pushRetryResult({
        id: `${item.id}-${Date.now()}`,
        title: item.title,
        sourceLabel: item.sourceLabel,
        status: result.success ? 'success' : 'failed',
        errorCode: result.errorCode,
        message: result.message,
        at: new Date().toISOString()
      });
      await loadItems();
      await loadStats();
    } catch (err: any) {
      const detail = err.message || '重试失败';
      setError(detail);
      pushRetryResult({
        id: `${item.id}-${Date.now()}`,
        title: item.title,
        sourceLabel: item.sourceLabel,
        status: 'failed',
        errorCode: err?.errorCode || null,
        message: detail,
        at: new Date().toISOString()
      });
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div>
      <ScopeContextBar
        moduleLabel="任务中心作用域"
        orgName={orgName}
        projectName={projectName}
        projectId={projectId}
        scopeLabel={projectId ? '项目级作用域' : '组织级作用域'}
        sourceLabel="PM 助手 / 自动化 / 飞书 / AI 对话"
        note={projectId ? '当前页面只聚合当前项目相关任务与日志。' : '当前页面展示当前组织全部项目范围内的任务与执行记录。'}
      />
      <div className="card">
        <div className="section-title-row">
          <h3>统一任务中心</h3>
          <button className="btn" type="button" onClick={() => void loadItems()} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
        <div className="muted">
          当前范围：{projectId ? `项目「${projectName || projectId}」` : '当前组织全部项目'}。这里统一查看 PM 助手、自动化规则、飞书写操作和 AI 对话。
        </div>
        <div className="task-center-summary-grid">
          <div className="task-center-summary-card">
            <div className="muted">总任务</div>
            <div className="task-center-summary-value">{stats?.total ?? 0}</div>
          </div>
          <div className="task-center-summary-card">
            <div className="muted">成功</div>
            <div className="task-center-summary-value">{statusCounts.success || 0}</div>
          </div>
          <div className="task-center-summary-card">
            <div className="muted">失败</div>
            <div className="task-center-summary-value">{statusCounts.failed || 0}</div>
          </div>
          <div className="task-center-summary-card">
            <div className="muted">成功率</div>
            <div className="task-center-summary-value">{successRate}</div>
          </div>
        </div>
        <div className="task-center-summary-grid task-center-summary-grid-secondary">
          <div className="task-center-summary-card">
            <div className="muted">高频错误码</div>
            <div className="task-center-summary-list">
              {topErrorCodes.length === 0
                ? '暂无失败错误码'
                : topErrorCodes.map((item) => `${item.errorCode} × ${item.count}`).join(' / ')}
            </div>
          </div>
          <div className="task-center-summary-card">
            <div className="muted">来源分布</div>
            <div className="task-center-summary-inline">PM {counts.pm_assistant} / 自动化 {counts.automation} / 飞书 {counts.feishu} / AI {counts.ai_chat}</div>
          </div>
          <div className="task-center-summary-card">
            <div className="muted">最近失败 Top 5</div>
            <div className="task-center-summary-list">
              {recentFailures.length === 0 ? '暂无失败项' : recentFailures.map((item) => item.title).join(' / ')}
            </div>
          </div>
          <div className="task-center-summary-card task-center-trend-card">
            <div className="section-title-row">
              <span className="muted">近 N 天趋势</span>
              <select value={statsDays} onChange={(e) => setStatsDays(Number(e.target.value))}>
                {[7, 14, 30].map((value) => (
                  <option key={value} value={value}>
                    {value} 天
                  </option>
                ))}
              </select>
            </div>
            <div className="task-center-trend-list">
              {weeklyTrend.map((bucket) => (
                <div key={bucket.day} className="task-center-trend-item">
                  <span>{bucket.day}</span>
                  <span>总 {bucket.total}</span>
                  <span>失 {bucket.failed}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="task-center-summary-grid task-center-summary-grid-secondary">
          {topErrorCodes.length > 0 && (
            <div className="task-center-summary-card task-center-error-code-card">
              <div className="muted">失败聚合</div>
              <div className="task-center-error-code-list">
                {topErrorCodes.map((item) => (
                  <div key={item.errorCode} className={`task-center-error-code-chip is-${item.severity}`}>
                    <span>{item.errorCode}</span>
                    <span>{item.sourceLabel}</span>
                    <strong>{item.count}</strong>
                    <div className="task-center-error-code-actions">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setStatus('failed');
                          setSeverity(item.severity);
                          setErrorCodeQuery(item.errorCode);
                        }}
                      >
                        筛选
                      </button>
                      {getRecoveryView({ source: sourceFromLabel(item.sourceLabel), errorCode: item.errorCode }) && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            setStatus('failed');
                            setSeverity(item.severity);
                            setErrorCodeQuery(item.errorCode);
                            navigateToRecovery({
                              source: sourceFromLabel(item.sourceLabel),
                              errorCode: item.errorCode,
                              severity: item.severity,
                              recoveryEntry: null
                            });
                          }}
                        >
                          前往处理
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="task-center-summary-card">
            <div className="muted">最近恢复结果</div>
            <div className="task-center-summary-list">
              {recentRetryResults.length === 0
                ? '暂无重试记录'
                : recentRetryResults.map((item) => `${item.sourceLabel}/${item.title} · ${item.status === 'success' ? '已触发' : '失败'}`).join(' / ')}
            </div>
          </div>
        </div>
        <div className="task-center-health-grid">
          {sourceHealthCards.map((card) => (
            <div key={card.key} className="task-center-health-card">
              <div className="section-title-row">
                <span>{card.label}</span>
                <span className={`task-center-health-badge is-${card.health}`}>{card.health}</span>
              </div>
              <div className="task-center-health-main">
                <div className="task-center-health-rate">{card.rate}%</div>
                <div className="muted">成功率</div>
              </div>
              <div className="task-center-health-meta">
                <span>总数 {card.total}</span>
                <span>失败 {card.failed}</span>
              </div>
            </div>
          ))}
        </div>
        <TableToolbar className="task-center-toolbar">
          <div className="table-toolbar-section table-toolbar-section--grow">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索标题、摘要、项目、操作人"
            />
            <select value={source} onChange={(e) => setSource(e.target.value as TaskCenterSource | 'all')}>
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskCenterStatus | 'all')}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as TaskCenterSeverity | 'all')}>
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={errorCodeQuery}
              onChange={(e) => setErrorCodeQuery(e.target.value)}
              placeholder="错误码，如 TC-FEI-403"
            />
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[30, 60, 100].map((value) => (
                <option key={value} value={value}>
                  最近 {value} 条
                </option>
              ))}
            </select>
          </div>
          <div className="table-toolbar-section table-toolbar-section--actions">
            <div className="table-toolbar-meta">
              统计窗口 {statsDays} 天，列表原始 {items.length} 条，筛后 {filteredItems.length} 条
            </div>
          </div>
        </TableToolbar>
        {error && <div className="warn task-center-error">{error}</div>}
        {lastRetryMessage && <div className="task-center-retry-note">{lastRetryMessage}</div>}
      </div>

      <div className="card task-center-card-gap">
        {recentRetryResults.length > 0 && (
          <div className="task-center-retry-history">
            {recentRetryResults.map((item) => (
              <div key={item.id} className={`task-center-retry-history-item is-${item.status}`}>
                <div className="task-center-retry-history-head">
                  <strong>{item.sourceLabel}</strong>
                  <span>{item.at.replace('T', ' ').slice(0, 19)}</span>
                </div>
                <div>{item.title}</div>
                <div className="muted">{item.message}{item.errorCode ? `（${item.errorCode}）` : ''}</div>
              </div>
            ))}
          </div>
        )}
        {loading && (
          <AsyncStatePanel
            tone="loading"
            title="正在刷新任务中心"
            description="正在聚合 PM 助手、自动化规则、飞书与 AI 对话执行记录。"
          />
        )}
        {!loading && filteredItems.length === 0 && (
          <AsyncStatePanel
            tone={error ? 'error' : 'empty'}
            title={error ? '任务中心加载异常' : '当前范围暂无任务记录'}
            description={error
              ? '请先检查后端服务、筛选条件或上方错误码提示，再重新刷新。'
              : '可以切换项目、放宽筛选条件，或等待新的执行记录写入后再查看。'}
            action={(
              <button className="btn" type="button" onClick={() => void loadItems()} disabled={loading}>
                重新刷新
              </button>
            )}
          />
        )}
        {!loading && filteredItems.length > 0 && (
        <table className="table table-wrap">
          <thead>
            <tr>
              <th>时间</th>
              <th>来源</th>
              <th>标题</th>
              <th>状态</th>
              <th>触发/操作人</th>
              <th>所属项目</th>
              <th>摘要</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <Fragment key={item.id}>
                <tr key={item.id}>
                  <td>{item.createdAt.replace('T', ' ').slice(0, 19)}</td>
                  <td>{item.sourceLabel}</td>
                  <td>{item.title}</td>
                  <td>
                    <span style={{ color: getStatusTone(item.status) }}>{item.status}</span>
                  </td>
                  <td>{item.trigger || item.actorName || '-'}</td>
                  <td>{item.projectName || '-'}</td>
                  <td>{item.summary || '-'}</td>
                  <td>
                    <div className="task-center-actions">
                      <button className="btn" type="button" onClick={() => setExpandedId((prev) => prev === item.id ? null : item.id)}>
                        {expandedId === item.id ? '收起' : '详情'}
                      </button>
                      {item.retryable && (
                        <button className="btn" type="button" onClick={() => void retryItem(item)} disabled={retryingId === item.id}>
                          {retryingId === item.id ? '执行中...' : getRetryLabel(item)}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === item.id && (
                  <tr key={`${item.id}-detail`}>
                    <td colSpan={8} className="task-center-detail-cell">
                      <div className="task-center-detail-title">详情</div>
                      <div className="task-center-detail-meta">
                        {item.errorCode ? (
                          <span className="task-center-detail-badge is-info">
                            错误码：{item.errorCode}
                          </span>
                        ) : null}
                        {item.errorCategory ? (
                          <span className={`task-center-detail-badge is-${item.severity || 'info'}`}>
                            错误分类：{item.errorCategory}
                          </span>
                        ) : null}
                        <span className={`task-center-detail-badge is-${item.severity || 'info'}`}>
                          严重级别：{getSeverityLabel(item)}
                        </span>
                      </div>
                      {item.recoveryHint ? (
                        <div className="task-center-detail-hint">
                          恢复建议：{item.recoveryHint}
                        </div>
                      ) : null}
                      {item.recoveryEntry ? (
                        <div className="task-center-detail-entry">
                          推荐入口：{item.recoveryEntry}
                          {getRecoveryView(item) && onNavigate ? (
                            <button
                              type="button"
                              className="btn task-center-detail-entry-btn"
                              onClick={() => navigateToRecovery(item)}
                            >
                              前往处理
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {item.recoveryChecklist && item.recoveryChecklist.length > 0 ? (
                        <div className="task-center-detail-checklist">
                          {item.recoveryChecklist.map((step, index) => (
                            <div key={`${item.id}-step-${index}`} className="task-center-detail-checklist-item">
                              <span className="task-center-detail-checklist-index">{index + 1}</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <pre className="task-center-detail-pre">{item.detail || '暂无更多上下文。'}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
