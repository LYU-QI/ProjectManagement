import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../api/client';
import usePersistentBoolean from '../hooks/usePersistentBoolean';
import ThemedSelect from '../components/ui/ThemedSelect';

const COLOR_MAP: Record<string, string> = {
  red: 'var(--color-danger)',
  orange: 'var(--color-warning)',
  green: 'var(--color-success)',
  blue: 'var(--color-primary)',
  purple: 'var(--color-primary)'
};

type Job = {
  id: string;
  name: string;
  color: 'red' | 'orange' | 'green' | 'blue' | 'purple';
  description: string;
};

type RunResult = {
  jobId: string;
  sent: boolean;
  summary: string;
  card: unknown;
};

type LogEntry = {
  id: string;
  jobId: string;
  triggeredBy: 'manual' | 'schedule';
  status: 'success' | 'failed' | 'dry-run' | 'skipped';
  summary: string;
  rawSummary?: string;
  aiSummary?: string;
  error?: string;
  createdAt: string;
};

type ScheduleItem = {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  jobs: string[];
};

type JobConfig = {
  jobId: string;
  enabled: boolean;
};

type DefaultPrompt = {
  jobId: string;
  name: string;
  prompt: string;
};

type PmAssistantViewProps = {
  projectId?: number;
};

export default function PmAssistantView({ projectId }: PmAssistantViewProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [dryRun, setDryRun] = useState(true);
  const [receiveId, setReceiveId] = useState('');

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState('');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logFilterStatus, setLogFilterStatus] = useState<'all' | 'success' | 'failed' | 'dry-run' | 'skipped'>('all');
  const [logFilterTrigger, setLogFilterTrigger] = useState<'all' | 'manual' | 'schedule'>('all');
  const [logFilterJob, setLogFilterJob] = useState<'all' | string>('all');
  const [logFilterToday, setLogFilterToday] = useState(false);
  const [logFiltersOpen, setLogFiltersOpen] = usePersistentBoolean('ui:pm-assistant:logFiltersOpen', true);
  const [compactLogsTable, setCompactLogsTable] = usePersistentBoolean('ui:pm-assistant:compactLogsTable', false);

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [schedulesError, setSchedulesError] = useState('');
  const [timezoneDraft, setTimezoneDraft] = useState('');
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const [savingTimezone, setSavingTimezone] = useState(false);

  const [jobConfigs, setJobConfigs] = useState<JobConfig[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const [aiConfigLoading, setAiConfigLoading] = useState(false);
  const [aiConfigError, setAiConfigError] = useState('');
  const [aiConfigSaving, setAiConfigSaving] = useState(false);
  const [defaultPrompts, setDefaultPrompts] = useState<DefaultPrompt[]>([]);
  const [defaultPromptsOpen, setDefaultPromptsOpen] = useState(false);
  const [jobPromptDrafts, setJobPromptDrafts] = useState<Record<string, string>>({});
  const [showJobToggles, setShowJobToggles] = useState(false);

  useEffect(() => {
    const loadJobs = async () => {
      setJobsLoading(true);
      setJobsError('');
      try {
        const res = await apiGet<Job[]>('/pm-assistant/jobs');
        setJobs(res);
        if (!selectedJobId && res.length > 0) {
          setSelectedJobId(res[0].id);
        }
      } catch (err: any) {
        setJobsError(err.message || '加载任务列表失败');
      } finally {
        setJobsLoading(false);
      }
    };
    void loadJobs();
  }, [selectedJobId]);

  useEffect(() => {
    const loadSchedules = async () => {
      setSchedulesLoading(true);
      setSchedulesError('');
      try {
        const qs = projectId ? `?projectId=${projectId}` : '';
        const res = await apiGet<ScheduleItem[]>(`/pm-assistant/schedules${qs}`);
        setSchedules(res);
        if (res.length > 0) {
          setTimezoneDraft(res[0].timezone);
        }
      } catch (err: any) {
        setSchedulesError(err.message || '加载定时配置失败');
      } finally {
        setSchedulesLoading(false);
      }
    };
    void loadSchedules();
  }, [projectId]);

  useEffect(() => {
    void loadLogs();
  }, [projectId]);

  useEffect(() => {
    const loadConfigs = async () => {
      setConfigLoading(true);
      setConfigError('');
      try {
        const qs = projectId ? `?projectId=${projectId}` : '';
        const res = await apiGet<JobConfig[]>(`/pm-assistant/configs${qs}`);
        setJobConfigs(res);
      } catch (err: any) {
        setConfigError(err.message || '加载任务开关失败');
      } finally {
        setConfigLoading(false);
      }
    };
    void loadConfigs();
  }, [projectId]);

  useEffect(() => {
    const loadAiConfig = async () => {
      setAiConfigLoading(true);
      setAiConfigError('');
      try {
        if (!projectId) {
          setJobPromptDrafts({});
          return;
        }
        const res = await apiGet<Record<string, string>>(`/pm-assistant/prompt-configs?projectId=${projectId}`);
        const nextDrafts: Record<string, string> = {};
        jobs.forEach((job) => {
          nextDrafts[job.id] = res[job.id] || '';
        });
        setJobPromptDrafts(nextDrafts);
      } catch (err: any) {
        setAiConfigError(err.message || '加载 AI 提示词失败');
      } finally {
        setAiConfigLoading(false);
      }
    };
    void loadAiConfig();
  }, [jobs, projectId]);

  useEffect(() => {
    const loadDefaultPrompts = async () => {
      try {
        const res = await apiGet<DefaultPrompt[]>('/pm-assistant/prompts');
        setDefaultPrompts(res);
      } catch {
        // ignore
      }
    };
    void loadDefaultPrompts();
  }, []);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId), [jobs, selectedJobId]);
  const filteredJobs = useMemo(() => jobs, [jobs]);
  const filteredLogs = useMemo(() => {
    const keyword = logSearch.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return logs.filter((log) => {
      if (logFilterStatus !== 'all' && log.status !== logFilterStatus) return false;
      if (logFilterTrigger !== 'all' && log.triggeredBy !== logFilterTrigger) return false;
      if (logFilterJob !== 'all' && log.jobId !== logFilterJob) return false;
      if (logFilterToday && !log.createdAt.startsWith(today)) return false;
      if (!keyword) return true;
      const hay = [
        log.jobId,
        log.summary,
        log.rawSummary || '',
        log.aiSummary || '',
        log.error || ''
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(keyword);
    });
  }, [logs, logSearch, logFilterStatus, logFilterTrigger, logFilterToday, logFilterJob]);

  function getLogStatusColor(status: LogEntry['status']): string {
    if (status === 'failed') return 'var(--color-danger)';
    if (status === 'dry-run') return 'var(--color-warning)';
    if (status === 'skipped') return 'var(--color-text-muted)';
    return 'var(--color-success)';
  }

  async function runJob() {
    if (!selectedJobId) return;
    setRunning(true);
    setRunError('');
    setRunResult(null);
    try {
      const res = await apiPost<RunResult>('/pm-assistant/run', {
        jobId: selectedJobId,
        dryRun,
        receiveId: receiveId.trim() || undefined,
        projectId: projectId || undefined
      });
      setRunResult(res);
      void loadLogs();
    } catch (err: any) {
      setRunError(err.message || '执行失败');
    } finally {
      setRunning(false);
    }
  }

  async function loadLogs() {
    setLogsLoading(true);
    setLogsError('');
    try {
      const qs = projectId ? `?projectId=${projectId}` : '';
      const res = await apiGet<LogEntry[]>(`/pm-assistant/logs${qs}`);
      setLogs(res);
    } catch (err: any) {
      setLogsError(err.message || '加载执行记录失败');
    } finally {
      setLogsLoading(false);
    }
  }

  function exportLogsCsv() {
    const rows = filteredLogs.map((log) => ({
      createdAt: log.createdAt,
      jobId: log.jobId,
      triggeredBy: log.triggeredBy,
      status: log.status,
      summary: log.summary,
      rawSummary: log.rawSummary || '',
      aiSummary: log.aiSummary || '',
      error: log.error || ''
    }));
    const header = ['createdAt', 'jobId', 'triggeredBy', 'status', 'summary', 'rawSummary', 'aiSummary', 'error'];
    const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const lines = [header.join(','), ...rows.map((row) => header.map((key) => escape((row as any)[key] ?? '')).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pm-assistant-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveSchedule(item: ScheduleItem) {
    setSavingScheduleId(item.id);
    setSchedulesError('');
    try {
      await apiPost('/pm-assistant/schedules', { id: item.id, cron: item.cron, projectId: projectId || undefined });
    } catch (err: any) {
      setSchedulesError(err.message || '保存定时配置失败');
    } finally {
      setSavingScheduleId(null);
    }
  }

  async function saveTimezone() {
    setSavingTimezone(true);
    setSchedulesError('');
    try {
      await apiPost('/pm-assistant/schedules/timezone', { timezone: timezoneDraft, projectId: projectId || undefined });
    } catch (err: any) {
      setSchedulesError(err.message || '保存时区失败');
    } finally {
      setSavingTimezone(false);
    }
  }

  async function updateJobConfig(jobId: string, enabled: boolean) {
    setSavingJobId(jobId);
    setConfigError('');
    try {
      await apiPost('/pm-assistant/configs', { jobId, enabled, projectId: projectId || undefined });
      setJobConfigs((prev) => prev.map((item) => item.jobId === jobId ? { ...item, enabled } : item));
    } catch (err: any) {
      setConfigError(err.message || '更新任务开关失败');
    } finally {
      setSavingJobId(null);
    }
  }

  async function updateAllJobs(enabled: boolean) {
    setBulkSaving(true);
    setConfigError('');
    try {
      for (const job of jobs) {
        await apiPost('/pm-assistant/configs', { jobId: job.id, enabled, projectId: projectId || undefined });
      }
      setJobConfigs((prev) => prev.map((item) => ({ ...item, enabled })));
    } catch (err: any) {
      setConfigError(err.message || '批量更新失败');
    } finally {
      setBulkSaving(false);
    }
  }


  async function saveAiConfig() {
    setAiConfigSaving(true);
    setAiConfigError('');
    try {
      if (!projectId) {
        setAiConfigError('请先选择项目后再保存提示词配置');
        return;
      }
      await apiPost('/pm-assistant/prompt-configs', { projectId, prompts: jobPromptDrafts });
    } catch (err: any) {
      setAiConfigError(err.message || '保存 AI 提示词失败');
    } finally {
      setAiConfigSaving(false);
    }
  }

  return (
    <div>
      <div className="card pm-intro-card">
        <div className="pm-intro-text">
          PM Assistant 会根据飞书多维表格任务数据生成卡片，并按配置发送到飞书群。定时任务由后端自动触发，这里提供手动校验入口。
        </div>
        <div className="pm-intro-text">
          如需启用定时任务，请在系统配置中设置 `FEISHU_PM_ASSISTANT_ENABLED=true`。
        </div>
        {!projectId && (
          <div className="warn pm-warn-top">当前未选择项目，编辑配置将应用到全局默认项。建议先切换到目标项目再配置。</div>
        )}
      </div>

      <div className="card pm-card-gap">
        <div className="pm-row-head">
          <h3 className="pm-section-title">AI 提示词配置（按类型）</h3>
          <button className="btn" onClick={() => void saveAiConfig()} disabled={aiConfigSaving}>
            {aiConfigSaving ? '保存中...' : '保存配置'}
          </button>
        </div>
        {aiConfigLoading && <div className="pm-muted-sm">正在加载 AI 配置...</div>}
        {aiConfigError && <div className="warn pm-warn-top">{aiConfigError}</div>}
        <details className="pm-details-box">
          <summary className="pm-details-summary-strong">
            展开按类型编辑 Prompt
          </summary>
          <div className="pm-grid-top">
            {jobs.map((job) => (
              <div key={job.id} className="pm-item-card">
                <div className="pm-item-title">{job.name}</div>
                <textarea
                  rows={3}
                  value={jobPromptDrafts[job.id] ?? ''}
                  onChange={(e) => setJobPromptDrafts((prev) => ({ ...prev, [job.id]: e.target.value }))}
                  placeholder="留空则使用内置默认 prompt"
                  className="pm-prompt-textarea"
                />
              </div>
            ))}
            <div className="pm-muted-sm">
              留空将自动使用内置默认 System Prompt。
            </div>
          </div>
        </details>
        <details open={defaultPromptsOpen} onToggle={(e) => setDefaultPromptsOpen((e.target as HTMLDetailsElement).open)} className="pm-details-gap">
          <summary className="pm-details-summary">
            查看各类型默认 System Prompt
          </summary>
          <div className="pm-grid-top">
            {defaultPrompts.length === 0 && (
              <div className="pm-muted-sm">暂无默认提示词数据。</div>
            )}
            {defaultPrompts.map((item) => (
              <div key={item.jobId} className="pm-item-card">
                <div className="pm-item-title">{item.name}</div>
                <div className="pm-muted-sm pm-text-top">{item.prompt}</div>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="card pm-card-gap">
        <details open={showJobToggles} onToggle={(e) => setShowJobToggles((e.target as HTMLDetailsElement).open)}>
          <summary className="pm-toggle-summary">
            <span>任务开关</span>
            <span className="pm-muted-sm">
              {showJobToggles ? '收起' : '展开'}
            </span>
          </summary>
          <div className="pm-section-top">
            <div className="pm-toolbar-wrap">
              <button className="btn" onClick={() => void updateAllJobs(true)} disabled={bulkSaving}>
                {bulkSaving ? '处理中...' : '全选启用'}
              </button>
              <button className="btn" onClick={() => void updateAllJobs(false)} disabled={bulkSaving}>
                {bulkSaving ? '处理中...' : '全选停用'}
              </button>
            </div>
            {configLoading && <div className="pm-muted-sm">正在加载任务开关...</div>}
            {configError && <div className="warn pm-warn-top">{configError}</div>}
            {jobConfigs.length > 0 && (
              <div className="pm-job-grid">
                {filteredJobs.map((job) => {
                  const config = jobConfigs.find((item) => item.jobId === job.id);
                  const enabled = config?.enabled ?? true;
                  return (
                    <label key={job.id} className="pm-job-card">
                      <div>
                        <div className={`pm-job-name ${enabled ? 'is-enabled' : 'is-disabled'}`}>
                          {job.name}
                        </div>
                        <div className="pm-job-desc">{job.description}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={savingJobId === job.id}
                        onChange={(e) => void updateJobConfig(job.id, e.target.checked)}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      </div>

      <div className="card pm-card-gap">
        <div className="pm-row-head">
          <h3 className="pm-section-title">定时任务配置</h3>
          <div className="pm-timezone-row">
            <label className="pm-form-label">时区</label>
            <input
              value={timezoneDraft}
              onChange={(e) => setTimezoneDraft(e.target.value)}
              className="pm-timezone-input"
            />
            <button className="btn" disabled={!timezoneDraft || savingTimezone} onClick={() => void saveTimezone()}>
              {savingTimezone ? '保存中...' : '保存时区'}
            </button>
          </div>
        </div>
        {schedulesLoading && <div className="pm-muted-sm">正在加载定时配置...</div>}
        {schedulesError && <div className="warn pm-warn-top">{schedulesError}</div>}
        {schedules.length > 0 && (
          <div className="pm-table-wrap">
            <table className="table pm-table-sm">
              <thead>
                <tr>
                  <th>批次</th>
                  <th>Cron</th>
                  <th>任务</th>
                  <th className="pm-col-action">操作</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                        <input
                          value={item.cron}
                          onChange={(e) =>
                            setSchedules((prev) => prev.map((row) => row.id === item.id ? { ...row, cron: e.target.value } : row))
                          }
                          className="pm-cron-input"
                        />
                      </td>
                    <td>{item.jobs.join(', ')}</td>
                    <td>
                      <button
                        className="btn"
                        onClick={() => void saveSchedule(item)}
                        disabled={savingScheduleId === item.id}
                      >
                        {savingScheduleId === item.id ? '保存中...' : '保存'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card pm-card-gap">
        <div className="pm-run-grid">
          <div>
            <label className="pm-form-label">任务类型</label>
            <ThemedSelect
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              disabled={jobsLoading || jobs.length === 0}
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </ThemedSelect>
            {jobsLoading && <div className="pm-muted-sm pm-text-top">正在加载任务列表...</div>}
            {jobsError && <div className="warn pm-warn-top">{jobsError}</div>}
          </div>
          <div>
            <label className="pm-form-label">任务说明</label>
            <div className="pm-job-info-box">
              <div className="pm-job-name-highlight" style={{ color: selectedJob ? COLOR_MAP[selectedJob.color] : 'var(--text-muted)' }}>
                {selectedJob?.name || '未选择任务'}
              </div>
              <div className="pm-muted-sm pm-text-top pm-job-desc-text">
                {selectedJob?.description || '请选择任务查看描述。'}
              </div>
            </div>
          </div>
        </div>

        <div className="pm-run-toolbar">
          <label className="pm-check-inline pm-check-card">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            仅预览（dryRun，不发送飞书）
          </label>
          <div className="pm-receive-row pm-receive-card">
            <label className="pm-form-label pm-receive-label">指定群聊 ID（可选）</label>
            <input
              value={receiveId}
              onChange={(e) => setReceiveId(e.target.value)}
              placeholder="oc_xxx"
              className="pm-receive-input"
            />
          </div>
          <button className="btn pm-run-submit" onClick={() => void runJob()} disabled={!selectedJobId || running}>
            {running ? '执行中...' : '运行一次'}
          </button>
        </div>

        {runError && (
          <div className="warn pm-warn-gap">
            {runError}
          </div>
        )}
      </div>

      {runResult && (
        <div className="card pm-result-card">
          <div className="pm-muted-sm pm-result-head">
            执行结果：{runResult.sent ? '已发送' : '仅预览'}
          </div>
          <div className="pm-result-summary">
            {runResult.summary}
          </div>
          <details className="pm-details-gap">
            <summary className="pm-details-summary">查看卡片 JSON</summary>
            <pre className="pm-json-pre">
{JSON.stringify(runResult.card, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div className="card pm-card-gap-top">
        <div className="panel-header">
          <h3 className="pm-section-title">执行记录</h3>
          <div className="panel-actions">
            <button className="btn" type="button" onClick={() => setCompactLogsTable((prev) => !prev)}>
              {compactLogsTable ? '标准密度' : '紧凑密度'}
            </button>
            <button className="btn" type="button" onClick={() => setLogFiltersOpen((prev) => !prev)}>
              {logFiltersOpen ? '收起筛选' : '展开筛选'}
            </button>
            <button className="btn" onClick={() => void loadLogs()} disabled={logsLoading}>
              {logsLoading ? '刷新中...' : '刷新'}
            </button>
            <button className="btn" onClick={exportLogsCsv} disabled={filteredLogs.length === 0}>
              导出 CSV
            </button>
          </div>
        </div>
        {logFiltersOpen && (
          <div className="filter-panel">
            <div className="filters-grid pm-log-filters-grid">
              <input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="搜索日志..."
              />
              <ThemedSelect value={logFilterStatus} onChange={(e) => setLogFilterStatus(e.target.value as typeof logFilterStatus)}>
                <option value="all">全部状态</option>
                <option value="success">成功</option>
                <option value="failed">失败</option>
                <option value="dry-run">预览</option>
                <option value="skipped">已跳过</option>
              </ThemedSelect>
              <ThemedSelect value={logFilterTrigger} onChange={(e) => setLogFilterTrigger(e.target.value as typeof logFilterTrigger)}>
                <option value="all">全部来源</option>
                <option value="manual">手动</option>
                <option value="schedule">定时</option>
              </ThemedSelect>
              <ThemedSelect value={logFilterJob} onChange={(e) => setLogFilterJob(e.target.value)}>
                <option value="all">全部任务</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.name}</option>
                ))}
              </ThemedSelect>
              <label className="pm-check-inline pm-log-filter-today">
                <input type="checkbox" checked={logFilterToday} onChange={(e) => setLogFilterToday(e.target.checked)} />
                只看今天
              </label>
            </div>
          </div>
        )}
        {logsError && <div className="warn pm-warn-bottom">{logsError}</div>}
        {filteredLogs.length === 0 && !logsLoading && (
          <div className="pm-muted-sm">暂无执行记录</div>
        )}
        {filteredLogs.length > 0 && (
          <div className="table-wrap">
            <table className={`table ${compactLogsTable ? 'table-compact' : ''} pm-table-sm`}>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>任务</th>
                  <th>来源</th>
                  <th>状态</th>
                  <th>摘要</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.jobId}</td>
                    <td>{log.triggeredBy === 'manual' ? '手动' : '定时'}</td>
                    <td style={{ color: getLogStatusColor(log.status) }}>
                      {log.status}
                    </td>
                    <td>
                      {log.summary}
                      {log.aiSummary && log.rawSummary && log.aiSummary !== log.rawSummary && (
                        <details className="pm-details-top-sm">
                          <summary className="pm-details-summary">查看原始摘要</summary>
                          <div className="pm-raw-summary">
                            {log.rawSummary}
                          </div>
                        </details>
                      )}
                      {log.error && <div className="pm-log-error">{log.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
