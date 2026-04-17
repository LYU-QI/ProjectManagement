import { Suspense, lazy, useEffect, useState } from 'react';
import { apiPost } from '../api/client';
import AsyncStatePanel from '../components/AsyncStatePanel';
import ThemedSelect from '../components/ui/ThemedSelect';
import ScopeContextBar from '../components/ScopeContextBar';

const RichMarkdown = lazy(() => import('../components/markdown/RichMarkdown'));

type ProjectItem = {
  id: number;
  name: string;
};

type Props = {
  aiReport: string;
  aiReportSource: string;
  onGenerate: () => void;
  activeOrgName?: string | null;
  projects: ProjectItem[];
  selectedProjectId: number | null;
  selectedProjectName?: string;
  onSelectProject: (id: number | null) => void;
};

export default function AiView({
  aiReport,
  aiReportSource,
  onGenerate,
  activeOrgName,
  projects,
  selectedProjectId,
  selectedProjectName,
  onSelectProject
}: Props) {
  const [weeklyDraft, setWeeklyDraft] = useState(aiReport);
  const [progressDraft, setProgressDraft] = useState('');
  const [copiedWeekly, setCopiedWeekly] = useState(false);
  const [copiedProgress, setCopiedProgress] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'progress' | 'nlp' | 'meeting'>('weekly');

  // 自然语言录入状态
  type ParsedTask = {
    id?: string;
    taskName: string; assignee: string; startDate: string;
    endDate: string; priority: string; status: string; notes: string;
    projectName?: string;
  };
  const [nlpText, setNlpText] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [nlpResult, setNlpResult] = useState<ParsedTask | null>(null);
  const [nlpError, setNlpError] = useState('');
  const [creatingFeishu, setCreatingFeishu] = useState(false);
  const [nlpConfirmed, setNlpConfirmed] = useState(false);

  // 会议纪要转任务状态
  const [meetingText, setMeetingText] = useState('');
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [meetingTasks, setMeetingTasks] = useState<ParsedTask[]>([]);
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<number[]>([]);
  const [meetingError, setMeetingError] = useState('');
  const [batchCreating, setBatchCreating] = useState(false);
  const [syncToFeishu, setSyncToFeishu] = useState(true);

  function formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(base: Date, days: number) {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  }

  function resolvePlannedDates(task: ParsedTask) {
    const today = new Date();
    const rawStart = task.startDate ? new Date(task.startDate) : null;
    const rawEnd = task.endDate ? new Date(task.endDate) : null;
    const start = rawStart && !Number.isNaN(rawStart.valueOf())
      ? rawStart
      : rawEnd && !Number.isNaN(rawEnd.valueOf())
        ? (rawEnd < today ? rawEnd : today)
        : today;
    const end = rawEnd && !Number.isNaN(rawEnd.valueOf())
      ? rawEnd
      : addDays(start, 7);
    return { plannedStart: formatDate(start), plannedEnd: formatDate(end) };
  }

  async function handleCreateToFeishu() {
    if (!nlpResult) return;
    if (!nlpConfirmed) {
      setNlpError('请先确认信息无误后再创建。');
      return;
    }

    const priorityMap: Record<string, string> = {
      high: '高',
      medium: '中',
      low: '低',
    };

    const statusMap: Record<string, string> = {
      todo: '待办',
      in_progress: '进行中',
      done: '已完成'
    };

    const projectItem = projects.find(p => p.id === selectedProjectId);
    const projectName = (nlpResult.projectName || '').trim() || projectItem?.name || '';

    const taskId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const fields: Record<string, any> = {
      任务ID: taskId,
      任务名称: nlpResult.taskName,
      负责人: nlpResult.assignee || '',
      开始时间: nlpResult.startDate || null,
      截止时间: nlpResult.endDate || null,
      优先级: priorityMap[nlpResult.priority] || '中',
      状态: statusMap[nlpResult.status] || '待办',
      所属项目: projectName,
      是否阻塞: '否',
      风险等级: '中',
      里程碑: '否'
    };
    Object.keys(fields).forEach((key) => {
      const value = fields[key];
      if (value === '' || value === null || value === undefined) {
        delete fields[key];
      }
    });

    setCreatingFeishu(true);
    setNlpError('');
    try {
      await apiPost('/feishu/records', { fields });
      setNlpResult(null);
      setNlpText('');
      alert('✅ 已成功在飞书同步列表中创建任务！');
    } catch (error: any) {
      setNlpError(error.message || '一键创建到飞书失败');
    } finally {
      setCreatingFeishu(false);
    }
  }

  async function handleNlpParse() {
    if (!nlpText.trim()) return;
    setNlpLoading(true);
    setNlpResult(null);
    setNlpError('');
    setNlpConfirmed(false);
    try {
      const selectedProject = projects.find((p) => p.id === selectedProjectId);
      const res = await apiPost<{ success: boolean; task?: ParsedTask; error?: string; source?: string }>('/ai/tasks/parse', {
        text: nlpText,
        projectName: selectedProject?.name
      });
      if (res.success && res.task) {
        setNlpResult({ ...res.task, projectName: selectedProject?.name || '' });
        setNlpConfirmed(false);
      } else {
        setNlpError(res.error || '解析失败，请手动填写。');
      }
    } finally {
      setNlpLoading(false);
    }
  }

  async function handleMeetingParse() {
    if (!meetingText.trim()) return;
    setMeetingLoading(true);
    setMeetingTasks([]);
    setMeetingError('');
    setSelectedTaskIndices([]);

    try {
      const res = await apiPost<{ success: boolean; tasks?: ParsedTask[]; error?: string }>('/ai/tasks/parse-meeting', {
        text: meetingText
      });
      if (res.success && res.tasks) {
        setMeetingTasks(res.tasks);
        setSelectedTaskIndices(res.tasks.map((_, i) => i));
      } else {
        setMeetingError(res.error || '未能提取到行动项');
      }
    } catch (err: any) {
      setMeetingError(err.message || '会议解析失败');
    } finally {
      setMeetingLoading(false);
    }
  }

  function updateNlpResult(patch: Partial<ParsedTask>) {
    setNlpResult((prev) => (prev ? { ...prev, ...patch } : prev));
    setNlpConfirmed(false);
  }

  async function handleBatchCreate() {
    if (selectedTaskIndices.length === 0) return;
    if (!selectedProjectId) {
      setMeetingError('请先选择目标工作区，再批量创建任务。');
      return;
    }
    setBatchCreating(true);
    setMeetingError('');

    const projectItem = projects.find(p => p.id === selectedProjectId);
    const priorityMap: Record<string, string> = { high: '高', medium: '中', low: '低' };
    const statusMap: Record<string, string> = { todo: '待办', in_progress: '进行中', done: '已完成' };

    let successCount = 0;
    try {
      for (const index of selectedTaskIndices) {
        const task = meetingTasks[index];
        const { plannedStart, plannedEnd } = resolvePlannedDates(task);
        const assignee = task.assignee?.trim() || '待指派';
        await apiPost('/projects/tasks', {
          projectId: selectedProjectId,
          title: task.taskName || '未命名任务',
          assignee,
          status: 'todo',
          plannedStart,
          plannedEnd
        });
        const taskId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const fields = {
          任务ID: taskId,
          任务名称: task.taskName || '未命名任务',
          负责人: assignee,
          开始时间: plannedStart || null,
          截止时间: plannedEnd || null,
          优先级: priorityMap[task.priority] || '中',
          状态: statusMap[task.status] || '待办',
          所属项目: projectItem?.name || '',
          是否阻塞: '否',
          风险等级: '中',
          里程碑: '否'
        };
        if (syncToFeishu) {
          await apiPost('/feishu/records', { fields });
        }
        successCount++;
      }
      if (syncToFeishu) {
        alert(`✅ 已创建 ${successCount} 个系统任务，并同步至飞书。`);
      } else {
        alert(`✅ 已创建 ${successCount} 个系统任务。`);
      }
      setMeetingTasks([]);
      setMeetingText('');
    } catch (err: any) {
      setMeetingError(`在创建第 ${successCount + 1} 个任务时出错: ${err.message}`);
    } finally {
      setBatchCreating(false);
    }
  }

  useEffect(() => {
    setWeeklyDraft(aiReport);
  }, [aiReport]);

  // 生成项目进展报告
  async function generateProgressReport() {
    if (!selectedProjectId) return;
    setGeneratingProgress(true);
    try {
      const res = await apiPost<{ report: string }>('/ai/reports/progress', {
        projectId: selectedProjectId
      });
      setProgressDraft(res.report);
      setActiveTab('progress');
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      setProgressDraft(`生成失败：${detail}`);
    } finally {
      setGeneratingProgress(false);
    }
  }

  // 下载文件
  function download(content: string, prefix: string) {
    const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 复制到剪贴板
  async function copy(content: string, setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(content || '');
      setter(true);
      setTimeout(() => setter(false), 1500);
    } catch {
      setter(false);
    }
  }

  // 编辑与预览模式切换
  const [weeklyViewMode, setWeeklyViewMode] = useState<'edit' | 'preview'>('preview');
  const [progressViewMode, setProgressViewMode] = useState<'edit' | 'preview'>('preview');

  return (
    <div>
      <ScopeContextBar
        moduleLabel="AI 分析作用域"
        orgName={activeOrgName}
        projectName={selectedProjectName}
        projectId={selectedProjectId}
        scopeLabel={selectedProjectId ? '项目级作用域' : '组织级作用域'}
        sourceLabel="统一项目指标 / 需求 / 任务 / 工时 / 飞书进度"
        note={selectedProjectId ? '周报、项目进展分析和聊天中的“当前项目”默认都以这里选中的项目为准。' : '未选择项目时，部分 AI 功能会回退为组织范围或要求先选定目标工作区。'}
      />
      {/* 目标工作区选择器 */}
      <div className="card ai-workspace-card">
        <div className="form ai-workspace-form">
          <div>
            <label className="ai-workspace-label">
              目标工作区
            </label>
            <ThemedSelect
              value={selectedProjectId == null ? '' : String(selectedProjectId)}
              onChange={(e) => {
                const value = e.target.value;
                onSelectProject(value ? Number(value) : null);
              }}
            >
              <option value="" disabled={projects.length > 0}>{projects.length === 0 ? '暂无项目' : '请选择目标工作区'}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (#{p.id})
                </option>
              ))}
            </ThemedSelect>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="ai-tab-nav">
        <button className={`btn btn-tab ai-tab-first ${activeTab === 'weekly' ? 'active' : ''}`} onClick={() => setActiveTab('weekly')}>
          📋 周报草稿
        </button>
        <button className={`btn btn-tab ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
          📊 项目进展报告
        </button>
        <button className={`btn btn-tab ${activeTab === 'nlp' ? 'active' : ''}`} onClick={() => setActiveTab('nlp')}>
          ✍️ 自然语言录入任务
        </button>
        <button className={`btn btn-tab ai-tab-last ${activeTab === 'meeting' ? 'active' : ''}`} onClick={() => setActiveTab('meeting')}>
          🎤 会议纪要转任务
        </button>
      </div>

      {/* 周报草稿 Tab */}
      {activeTab === 'weekly' && (
        <div className="card ai-tab-panel ai-tab-weekly">
          <div className="ai-tab-actions">
            <button className="btn" onClick={onGenerate}>生成周报草稿</button>
            <button className="btn" type="button" onClick={() => copy(weeklyDraft, setCopiedWeekly)} disabled={!weeklyDraft}>复制全文</button>
            <button className="btn" type="button" onClick={() => download(weeklyDraft, 'weekly-report')} disabled={!weeklyDraft}>下载 TXT</button>
            {copiedWeekly && <span className="ai-copy-ok">已复制</span>}

            <div className="ai-view-switch">
              <button className={`btn btn-small btn-mode ${weeklyViewMode === 'edit' ? 'active' : ''}`} onClick={() => setWeeklyViewMode('edit')}>📝 编辑源码</button>
              <button className={`btn btn-small btn-mode ${weeklyViewMode === 'preview' ? 'active' : ''}`} onClick={() => setWeeklyViewMode('preview')}>👁 渲染预览</button>
            </div>
          </div>

          {/* 模板模式提示：引导用户配置 AI */}
          {aiReportSource === 'template' && weeklyDraft && (
            <div className="ai-template-tip">
              <span className="ai-template-tip-icon">⚠️</span>
              <div className="ai-template-tip-main">
                <div className="ai-template-tip-title">
                  当前为模板模式 — AI 智能分析未启用
                </div>
                <div className="ai-template-tip-desc">
                  前往左侧菜单「⚙ 系统配置」填写 <strong className="ai-strong">AI_API_URL</strong>、<strong className="ai-strong">AI_API_KEY</strong> 和 <strong className="ai-strong">AI_MODEL</strong>，即可启用 AI 深度分析周报。
                </div>
              </div>
            </div>
          )}

          {weeklyViewMode === 'edit' ? (
            <textarea
              rows={20}
              value={weeklyDraft || ''}
              onChange={(e) => setWeeklyDraft(e.target.value)}
              placeholder="选择目标工作区后，点击按钮生成周报草稿"
              className="ai-report-editor"
            />
          ) : (
            <div className="markdown-body ai-markdown-view">
              {weeklyDraft ? (
                <Suspense
                  fallback={
                    <AsyncStatePanel
                      tone="loading"
                      title="正在加载预览"
                      description="正在准备周报 Markdown 渲染器。"
                    />
                  }
                >
                  <RichMarkdown>
                    {weeklyDraft}
                  </RichMarkdown>
                </Suspense>
              ) : (
                <div className="ai-empty-placeholder">暂无报告内容，点击生成即可预览。</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 项目进展报告 Tab */}
      {activeTab === 'progress' && (
        <div className="card ai-tab-panel ai-tab-progress">
          <div className="ai-tab-actions">
            <button
              className={`btn ${selectedProjectId ? 'btn-mode active' : ''}`}
              onClick={generateProgressReport}
              disabled={!selectedProjectId || generatingProgress}
            >
              {generatingProgress ? '⏳ 分析中...' : '🤖 AI 生成项目进展报告'}
            </button>
            <button className="btn" type="button" onClick={() => copy(progressDraft, setCopiedProgress)} disabled={!progressDraft}>复制全文</button>
            <button className="btn" type="button" onClick={() => download(progressDraft, 'progress-report')} disabled={!progressDraft}>下载 TXT</button>
            {copiedProgress && <span className="ai-copy-ok">已复制</span>}
            {!selectedProjectId && (
              <span className="ai-project-hint">请先选择目标工作区</span>
            )}

            <div className="ai-view-switch">
              <button className={`btn btn-small btn-mode ${progressViewMode === 'edit' ? 'active' : ''}`} onClick={() => setProgressViewMode('edit')}>📝 编辑源码</button>
              <button className={`btn btn-small btn-mode ${progressViewMode === 'preview' ? 'active' : ''}`} onClick={() => setProgressViewMode('preview')}>👁 渲染预览</button>
            </div>
          </div>

          {progressViewMode === 'edit' ? (
            <textarea
              rows={24}
              value={progressDraft || ''}
              onChange={(e) => setProgressDraft(e.target.value)}
              placeholder="选择目标工作区后，点击按钮生成项目进展分析报告（包含健康度评分、任务进度、预算分析、风险评估和 AI 建议）"
              className="ai-report-editor"
            />
          ) : (
            <div className="markdown-body ai-markdown-view">
              {progressDraft ? (
                <Suspense
                  fallback={
                    <AsyncStatePanel
                      tone="loading"
                      title="正在加载预览"
                      description="正在准备项目进展报告的 Markdown 渲染器。"
                    />
                  }
                >
                  <RichMarkdown>
                    {progressDraft}
                  </RichMarkdown>
                </Suspense>
              ) : (
                <div className="ai-empty-placeholder">暂无报告内容，选择项目并点击 AI 生成以预览分析。</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 自然语言录入任务 Tab */}
      {activeTab === 'nlp' && (
        <div className="card ai-tab-panel ai-tab-nlp">
          <div className="ai-section-hint">
            用自然语言描述任务，AI 自动解析为结构化字段。例如：「下周四前张三完成支付接口联调，大概 3 天，优先级很高」
          </div>

          <div className="ai-input-row">
            <textarea
              rows={3}
              value={nlpText}
              onChange={(e) => setNlpText(e.target.value)}
              placeholder="在此输入任务描述，支持口语化表达..."
              className="ai-input-textarea"
            />
            <button
              className="btn btn-strong-contrast ai-cta-primary"
              type="button"
              disabled={!nlpText.trim() || nlpLoading}
              onClick={() => void handleNlpParse()}
            >
              {nlpLoading ? '⏳ 解析中...' : '🪄 AI 解析'}
            </button>
          </div>

          {/* 错误提示 */}
          {nlpError && (
            <div className="ai-error-box">
              ⚠️ {nlpError}
            </div>
          )}

          {/* 解析结果预览 */}
          {nlpResult && (
            <div className="ai-result-wrap">
              <div className="ai-success-tip">
                ✅ 解析成功 — 可编辑后确认，再一键创建到飞书
              </div>
              <table className="table ai-edit-table">
                <tbody>
                  <tr>
                    <td className="ai-edit-label">任务名称</td>
                    <td>
                      <input
                        type="text"
                        value={nlpResult.taskName}
                        onChange={(e) => updateNlpResult({ taskName: e.target.value })}
                        className="ai-edit-input"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="ai-edit-label">负责人</td>
                    <td>
                      <input
                        type="text"
                        value={nlpResult.assignee || ''}
                        onChange={(e) => updateNlpResult({ assignee: e.target.value })}
                        className="ai-edit-input"
                        placeholder="未识别可手动填写"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="ai-edit-label">所属项目</td>
                    <td>
                      <input
                        type="text"
                        value={nlpResult.projectName || ''}
                        onChange={(e) => updateNlpResult({ projectName: e.target.value })}
                        className="ai-edit-input"
                        placeholder="如飞书为单选，请填写已有选项"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="ai-edit-label">开始日期</td>
                    <td>
                      <input
                        type="date"
                        value={nlpResult.startDate || ''}
                        onChange={(e) => updateNlpResult({ startDate: e.target.value })}
                        className="ai-edit-input"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="ai-edit-label">截止日期</td>
                    <td>
                      <input
                        type="date"
                        value={nlpResult.endDate || ''}
                        onChange={(e) => updateNlpResult({ endDate: e.target.value })}
                        className="ai-edit-input"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="ai-edit-label">优先级</td>
                    <td>
                      <ThemedSelect
                        value={nlpResult.priority || 'medium'}
                        onChange={(e) => updateNlpResult({ priority: e.target.value })}
                        className="ai-edit-input"
                      >
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                      </ThemedSelect>
                    </td>
                  </tr>
                  <tr>
                    <td className="ai-edit-label">状态</td>
                    <td>
                      <ThemedSelect
                        value={nlpResult.status || 'todo'}
                        onChange={(e) => updateNlpResult({ status: e.target.value })}
                        className="ai-edit-input"
                      >
                        <option value="todo">待办</option>
                        <option value="in_progress">进行中</option>
                        <option value="done">已完成</option>
                      </ThemedSelect>
                    </td>
                  </tr>
                  <tr>
                    <td className="ai-edit-label">补充说明</td>
                    <td>
                      <textarea
                        rows={2}
                        value={nlpResult.notes || ''}
                        onChange={(e) => updateNlpResult({ notes: e.target.value })}
                        className="ai-edit-input"
                        placeholder="可选"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="ai-confirm-row">
                <input
                  type="checkbox"
                  checked={nlpConfirmed}
                  onChange={(e) => setNlpConfirmed(e.target.checked)}
                />
                我已确认以上信息无误
              </div>
              <div className="ai-action-row">
                <button
                  className="btn btn-primary ai-primary-wide"
                  type="button"
                  disabled={creatingFeishu || !nlpConfirmed}
                  onClick={() => void handleCreateToFeishu()}
                >
                  {creatingFeishu ? '🚀 正在同步创建至飞书...' : '⚡ 一键创建至飞书同步列表'}
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setNlpResult(null);
                    setNlpText('');
                    setNlpError('');
                    setNlpConfirmed(false);
                  }}
                >
                  重置
                </button>
              </div>
            </div>
          )}

          {!nlpResult && !nlpError && !nlpLoading && (
            <div className="ai-empty-state">
              输入任务描述后点击「AI 解析」，即可自动提取任务字段
            </div>
          )}
        </div>
      )}

      {/* 会议纪要转任务 Tab */}
      {activeTab === 'meeting' && (
        <div className="card ai-tab-panel ai-tab-meeting">
          <div className="ai-section-hint">
            粘贴会议记录全文、纪要流水或群聊对话，AI 将自动提取行动项并允许批量同步至系统。
          </div>

          <div className="ai-input-row">
            <textarea
              rows={6}
              value={meetingText}
              onChange={(e) => setMeetingText(e.target.value)}
              placeholder="在这里粘贴会议纪要文本..."
              className="ai-input-textarea"
            />
            <button
              className="btn btn-strong-contrast ai-cta-warning"
              type="button"
              disabled={!meetingText.trim() || meetingLoading}
              onClick={() => void handleMeetingParse()}
            >
              {meetingLoading ? '⏳ 解析中...' : '🪄 提取任务'}
            </button>
          </div>

          {meetingError && (
            <div className="ai-error-box">
              ⚠️ {meetingError}
            </div>
          )}

          {meetingTasks.length > 0 && (
            <div className="ai-result-wrap ai-result-wrap-lg">
              <div className="ai-result-head">
                <div className="ai-warning-tip">
                  ✅ 识别到 {meetingTasks.length} 个行动项
                </div>
                <div className="ai-result-count">
                  已选中 {selectedTaskIndices.length} 项
                </div>
              </div>

              <div className="ai-sync-row">
                <label className="ai-sync-label">
                  <input
                    type="checkbox"
                    checked={syncToFeishu}
                    onChange={(e) => setSyncToFeishu(e.target.checked)}
                  />
                  同步到飞书进度列表
                </label>
                {!selectedProjectId && (
                  <span className="ai-danger-tip">未选择工作区，无法创建系统任务</span>
                )}
              </div>

              <div className="ai-task-table-wrap">
                <table className="table ai-edit-table">
                  <thead>
                    <tr>
                      <th className="ai-col-40">
                        <input
                          type="checkbox"
                          checked={selectedTaskIndices.length === meetingTasks.length && meetingTasks.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTaskIndices(meetingTasks.map((_, i) => i));
                            else setSelectedTaskIndices([]);
                          }}
                        />
                      </th>
                      <th>任务内容</th>
                      <th>负责人</th>
                      <th>开始日期</th>
                      <th>截止日期</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetingTasks.map((task, idx) => {
                      const { plannedStart, plannedEnd } = resolvePlannedDates(task);
                      return (
                      <tr key={idx} className={selectedTaskIndices.includes(idx) ? 'ai-row-selected' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedTaskIndices.includes(idx)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedTaskIndices([...selectedTaskIndices, idx]);
                              else setSelectedTaskIndices(selectedTaskIndices.filter(i => i !== idx));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={task.taskName}
                            onChange={(e) => {
                              const newTasks = [...meetingTasks];
                              newTasks[idx] = { ...task, taskName: e.target.value };
                              setMeetingTasks(newTasks);
                            }}
                            className="ai-meeting-inline-input"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={task.assignee || ''}
                            onChange={(e) => {
                              const newTasks = [...meetingTasks];
                              newTasks[idx] = { ...task, assignee: e.target.value };
                              setMeetingTasks(newTasks);
                            }}
                            className="ai-meeting-inline-input"
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={plannedStart}
                            onChange={(e) => {
                              const newTasks = [...meetingTasks];
                              newTasks[idx] = { ...task, startDate: e.target.value };
                              setMeetingTasks(newTasks);
                            }}
                            className="ai-meeting-inline-input"
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={plannedEnd}
                            onChange={(e) => {
                              const newTasks = [...meetingTasks];
                              newTasks[idx] = { ...task, endDate: e.target.value };
                              setMeetingTasks(newTasks);
                            }}
                            className="ai-meeting-inline-input"
                          />
                        </td>
                        <td>
                          <button
                            className="btn btn-small btn-danger"
                            type="button"
                            onClick={() => {
                              const newTasks = meetingTasks.filter((_, i) => i !== idx);
                              setMeetingTasks(newTasks);
                              setSelectedTaskIndices(selectedTaskIndices.filter(i => i !== idx));
                            }}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {meetingTasks.length > 0 && (
                <div className="ai-action-row ai-action-row-lg">
                  <button
                    className="btn btn-warning ai-primary-wide"
                    disabled={selectedTaskIndices.length === 0 || batchCreating || !selectedProjectId}
                    onClick={() => void handleBatchCreate()}
                  >
                    {batchCreating
                      ? '🚀 正在批量创建任务...'
                      : syncToFeishu
                        ? `⚡ 批量创建 ${selectedTaskIndices.length} 个任务并同步至飞书`
                        : `⚡ 批量创建 ${selectedTaskIndices.length} 个任务`}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setMeetingTasks([]);
                      setSelectedTaskIndices([]);
                      setMeetingText('');
                      setMeetingError('');
                    }}
                  >
                    重置
                  </button>
                </div>
              )}

              {!meetingTasks.length && !meetingLoading && !meetingError && (
                <div className="ai-empty-state">
                  输入会议文本后点击指示按钮提取行动项
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
