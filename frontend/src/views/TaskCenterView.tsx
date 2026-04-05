import { Fragment, useEffect, useMemo, useState } from 'react';
import { apiPost } from '../api/client';
import { getTaskCenterStats, listTaskCenterItems, TaskCenterItem, TaskCenterSource, TaskCenterStats, TaskCenterStatus } from '../api/taskCenter';
import useEventStream from '../hooks/useEventStream';

type Props = {
  projectId?: number | null;
  projectName?: string;
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

const SOURCE_HEALTH_META: Array<{ key: TaskCenterSource; label: string }> = [
  { key: 'pm_assistant', label: 'PM 助手' },
  { key: 'automation', label: '自动化规则' },
  { key: 'feishu', label: '飞书集成' },
  { key: 'ai_chat', label: 'AI 对话' }
];

export default function TaskCenterView({ projectId, projectName }: Props) {
  const [items, setItems] = useState<TaskCenterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<TaskCenterSource | 'all'>('all');
  const [status, setStatus] = useState<TaskCenterStatus | 'all'>('all');
  const [limit, setLimit] = useState(60);
  const [keyword, setKeyword] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [lastRetryMessage, setLastRetryMessage] = useState('');
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
  }, [projectId, source, status, limit]);

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

  async function retryItem(item: TaskCenterItem) {
    if (!item.retryable || !item.retryMeta) return;
    setRetryingId(item.id);
    setError('');
    setLastRetryMessage('');
    try {
      if (item.source === 'pm_assistant') {
        await apiPost('/pm-assistant/run', {
          jobId: item.retryMeta.jobId,
          projectId: item.retryMeta.projectId || undefined,
          dryRun: false
        });
      } else if (item.source === 'automation') {
        await apiPost(`/automations/${String(item.retryMeta.ruleId)}/run`, {
          payload: item.retryMeta.payload && typeof item.retryMeta.payload === 'object' ? item.retryMeta.payload as Record<string, unknown> : {}
        });
      }
      setLastRetryMessage(`已触发重试：${item.title}`);
      await loadItems();
      await loadStats();
    } catch (err: any) {
      setError(err.message || '重试失败');
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div>
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
        <div className="toolbar task-center-toolbar">
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
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[30, 60, 100].map((value) => (
              <option key={value} value={value}>
                最近 {value} 条
              </option>
            ))}
          </select>
          <div className="muted">
            统计窗口 {statsDays} 天，列表原始 {items.length} 条，筛后 {filteredItems.length} 条
          </div>
        </div>
        {error && <div className="warn task-center-error">{error}</div>}
        {lastRetryMessage && <div className="task-center-retry-note">{lastRetryMessage}</div>}
      </div>

      <div className="card task-center-card-gap">
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
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">暂无任务记录。</td>
              </tr>
            )}
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
                          {retryingId === item.id ? '重试中...' : '重试'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === item.id && (
                  <tr key={`${item.id}-detail`}>
                    <td colSpan={8} className="task-center-detail-cell">
                      <div className="task-center-detail-title">详情</div>
                      <pre className="task-center-detail-pre">{item.detail || '暂无更多上下文。'}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
