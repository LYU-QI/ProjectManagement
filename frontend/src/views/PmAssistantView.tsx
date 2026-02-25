import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../api/client';

const COLOR_MAP: Record<string, string> = {
  red: '#ff3366',
  orange: '#ff8800',
  green: '#00ff88',
  blue: '#00d2ff',
  purple: '#b44dff'
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

type ConfigItem = {
  key: string;
  value: string;
  group: string;
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
        const res = await apiGet<ScheduleItem[]>('/pm-assistant/schedules');
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
  }, []);

  useEffect(() => {
    void loadLogs();
  }, []);

  useEffect(() => {
    const loadConfigs = async () => {
      setConfigLoading(true);
      setConfigError('');
      try {
        const res = await apiGet<JobConfig[]>('/pm-assistant/configs');
        setJobConfigs(res);
      } catch (err: any) {
        setConfigError(err.message || '加载任务开关失败');
      } finally {
        setConfigLoading(false);
      }
    };
    void loadConfigs();
  }, []);

  useEffect(() => {
    const loadAiConfig = async () => {
      setAiConfigLoading(true);
      setAiConfigError('');
      try {
        const res = await apiGet<ConfigItem[]>('/config');
        const nextDrafts: Record<string, string> = {};
        jobs.forEach((job) => {
          const key = `FEISHU_PM_ASSISTANT_PROMPT_${job.id.toUpperCase().replace(/-/g, '_')}`;
          const item = res.find((row) => row.key === key);
          nextDrafts[job.id] = item?.value || '';
        });
        setJobPromptDrafts(nextDrafts);
      } catch (err: any) {
        setAiConfigError(err.message || '加载 AI 提示词失败');
      } finally {
        setAiConfigLoading(false);
      }
    };
    void loadAiConfig();
  }, [jobs]);

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
  }, [logs, logSearch, logFilterStatus, logFilterTrigger, logFilterToday]);

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
      const res = await apiGet<LogEntry[]>('/pm-assistant/logs');
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
      await apiPost('/pm-assistant/schedules', { id: item.id, cron: item.cron });
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
      await apiPost('/pm-assistant/schedules/timezone', { timezone: timezoneDraft });
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
      await apiPost('/pm-assistant/configs', { jobId, enabled });
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
        await apiPost('/pm-assistant/configs', { jobId: job.id, enabled });
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
      const payload: Record<string, string> = {};
      Object.entries(jobPromptDrafts).forEach(([jobId, prompt]) => {
        const key = `FEISHU_PM_ASSISTANT_PROMPT_${jobId.toUpperCase().replace(/-/g, '_')}`;
        payload[key] = prompt;
      });
      await apiPost('/config', payload);
    } catch (err: any) {
      setAiConfigError(err.message || '保存 AI 提示词失败');
    } finally {
      setAiConfigSaving(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid #00d2ff' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          PM Assistant 会根据飞书多维表格任务数据生成卡片，并按配置发送到飞书群。定时任务由后端自动触发，这里提供手动校验入口。
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          如需启用定时任务，请在系统配置中设置 `FEISHU_PM_ASSISTANT_ENABLED=true`。
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, letterSpacing: 1 }}>AI 提示词配置（按类型）</h3>
          <button className="btn" onClick={() => void saveAiConfig()} disabled={aiConfigSaving}>
            {aiConfigSaving ? '保存中...' : '保存配置'}
          </button>
        </div>
        {aiConfigLoading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>正在加载 AI 配置...</div>}
        {aiConfigError && <div className="warn" style={{ marginTop: 6 }}>{aiConfigError}</div>}
        <details style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 12px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#00d2ff', listStyle: 'none' }}>
            展开按类型编辑 Prompt
          </summary>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {jobs.map((job) => (
              <div key={job.id} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#00d2ff', marginBottom: 6 }}>{job.name}</div>
                <textarea
                  rows={3}
                  value={jobPromptDrafts[job.id] ?? ''}
                  onChange={(e) => setJobPromptDrafts((prev) => ({ ...prev, [job.id]: e.target.value }))}
                  placeholder="留空则使用内置默认 prompt"
                  style={{ width: '100%', fontFamily: 'monospace', lineHeight: 1.5 }}
                />
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              留空将自动使用内置默认 System Prompt。
            </div>
          </div>
        </details>
        <details open={defaultPromptsOpen} onToggle={(e) => setDefaultPromptsOpen((e.target as HTMLDetailsElement).open)} style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
            查看各类型默认 System Prompt
          </summary>
          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
            {defaultPrompts.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无默认提示词数据。</div>
            )}
            {defaultPrompts.map((item) => (
              <div key={item.jobId} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#00d2ff' }}>{item.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{item.prompt}</div>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <details open={showJobToggles} onToggle={(e) => setShowJobToggles((e.target as HTMLDetailsElement).open)}>
          <summary
            style={{
              listStyle: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              letterSpacing: 1
            }}
          >
            <span>任务开关</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {showJobToggles ? '收起' : '展开'}
            </span>
          </summary>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <button className="btn" onClick={() => void updateAllJobs(true)} disabled={bulkSaving}>
                {bulkSaving ? '处理中...' : '全选启用'}
              </button>
              <button className="btn" onClick={() => void updateAllJobs(false)} disabled={bulkSaving}>
                {bulkSaving ? '处理中...' : '全选停用'}
              </button>
            </div>
            {configLoading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>正在加载任务开关...</div>}
            {configError && <div className="warn" style={{ marginTop: 6 }}>{configError}</div>}
            {jobConfigs.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {filteredJobs.map((job) => {
                  const config = jobConfigs.find((item) => item.jobId === job.id);
                  const enabled = config?.enabled ?? true;
                  return (
                    <label
                      key={job.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 6,
                        background: 'rgba(0,0,0,0.25)'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: enabled ? '#00ff88' : '#ff8080' }}>
                          {job.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{job.description}</div>
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, letterSpacing: 1 }}>定时任务配置</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>时区</label>
            <input
              value={timezoneDraft}
              onChange={(e) => setTimezoneDraft(e.target.value)}
              style={{ width: 160 }}
            />
            <button className="btn" disabled={!timezoneDraft || savingTimezone} onClick={() => void saveTimezone()}>
              {savingTimezone ? '保存中...' : '保存时区'}
            </button>
          </div>
        </div>
        {schedulesLoading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>正在加载定时配置...</div>}
        {schedulesError && <div className="warn" style={{ marginTop: 6 }}>{schedulesError}</div>}
        {schedules.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>批次</th>
                  <th>Cron</th>
                  <th>任务</th>
                  <th style={{ width: 120 }}>操作</th>
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
                        style={{ width: 180 }}
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>任务类型</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              disabled={jobsLoading || jobs.length === 0}
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </select>
            {jobsLoading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>正在加载任务列表...</div>}
            {jobsError && <div className="warn" style={{ marginTop: 6 }}>{jobsError}</div>}
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>任务说明</label>
            <div style={{ marginTop: 6, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4 }}>
              <div style={{ fontSize: 13, color: selectedJob ? COLOR_MAP[selectedJob.color] : 'var(--text-muted)', fontWeight: 600 }}>
                {selectedJob?.name || '未选择任务'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                {selectedJob?.description || '请选择任务查看描述。'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            仅预览（dryRun，不发送飞书）
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>指定群聊 ID（可选）</label>
            <input
              value={receiveId}
              onChange={(e) => setReceiveId(e.target.value)}
              placeholder="oc_xxx"
              style={{ flex: 1 }}
            />
          </div>
          <button className="btn" onClick={() => void runJob()} disabled={!selectedJobId || running}>
            {running ? '执行中...' : '运行一次'}
          </button>
        </div>

        {runError && (
          <div className="warn" style={{ marginTop: 12 }}>
            {runError}
          </div>
        )}
      </div>

      {runResult && (
        <div className="card" style={{ borderLeft: '3px solid #00ff88' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            执行结果：{runResult.sent ? '已发送' : '仅预览'}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>
            {runResult.summary}
          </div>
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>查看卡片 JSON</summary>
            <pre style={{ marginTop: 8, fontSize: 12, background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 6, overflowX: 'auto' }}>
{JSON.stringify(runResult.card, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, letterSpacing: 1 }}>执行记录</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn" onClick={() => void loadLogs()} disabled={logsLoading}>
              {logsLoading ? '刷新中...' : '刷新'}
            </button>
            <button className="btn" onClick={exportLogsCsv} disabled={filteredLogs.length === 0}>
              导出 CSV
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.2fr) repeat(3, minmax(140px, 1fr)) auto', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <input
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            placeholder="搜索日志..."
          />
          <select value={logFilterStatus} onChange={(e) => setLogFilterStatus(e.target.value as any)}>
            <option value="all">全部状态</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
            <option value="dry-run">预览</option>
            <option value="skipped">已跳过</option>
          </select>
          <select value={logFilterTrigger} onChange={(e) => setLogFilterTrigger(e.target.value as any)}>
            <option value="all">全部来源</option>
            <option value="manual">手动</option>
            <option value="schedule">定时</option>
          </select>
          <select value={logFilterJob} onChange={(e) => setLogFilterJob(e.target.value)}>
            <option value="all">全部任务</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>{job.name}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={logFilterToday} onChange={(e) => setLogFilterToday(e.target.checked)} />
            只看今天
          </label>
        </div>
        {logsError && <div className="warn" style={{ marginBottom: 8 }}>{logsError}</div>}
        {filteredLogs.length === 0 && !logsLoading && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无执行记录</div>
        )}
        {filteredLogs.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: 12 }}>
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
                    <td style={{ color: log.status === 'failed' ? '#ff8080' : log.status === 'dry-run' ? '#ffaa00' : log.status === 'skipped' ? '#c0c0c0' : '#00ff88' }}>
                      {log.status}
                    </td>
                    <td>
                      {log.summary}
                      {log.aiSummary && log.rawSummary && log.aiSummary !== log.rawSummary && (
                        <details style={{ marginTop: 6 }}>
                          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>查看原始摘要</summary>
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 6 }}>
                            {log.rawSummary}
                          </div>
                        </details>
                      )}
                      {log.error && <div style={{ color: '#ff8080', marginTop: 4 }}>{log.error}</div>}
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
