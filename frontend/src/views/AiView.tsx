import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { apiPost } from '../api/client';

type ProjectItem = {
  id: number;
  name: string;
};

type Props = {
  aiReport: string;
  aiReportSource: string;
  onGenerate: () => void;
  projects: ProjectItem[];
  selectedProjectId: number | null;
  onSelectProject: (id: number | null) => void;
};

export default function AiView({ aiReport, aiReportSource, onGenerate, projects, selectedProjectId, onSelectProject }: Props) {
  const [weeklyDraft, setWeeklyDraft] = useState(aiReport);
  const [progressDraft, setProgressDraft] = useState('');
  const [copiedWeekly, setCopiedWeekly] = useState(false);
  const [copiedProgress, setCopiedProgress] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'progress' | 'nlp'>('weekly');

  // 自然语言录入状态
  type ParsedTask = {
    taskName: string; assignee: string; startDate: string;
    endDate: string; priority: string; status: string; notes: string;
  };
  const [nlpText, setNlpText] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [nlpResult, setNlpResult] = useState<ParsedTask | null>(null);
  const [nlpError, setNlpError] = useState('');
  const [creatingFeishu, setCreatingFeishu] = useState(false);

  async function handleCreateToFeishu() {
    if (!nlpResult) return;

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

    const fields = {
      任务名称: nlpResult.taskName,
      负责人: nlpResult.assignee || '',
      开始时间: nlpResult.startDate || null,
      截止时间: nlpResult.endDate || null,
      优先级: priorityMap[nlpResult.priority] || '中',
      状态: statusMap[nlpResult.status] || '待办',
      所属项目: projectItem?.name || '',
      是否阻塞: '否',
      风险等级: '中',
      里程碑: '否'
    };

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
    try {
      const selectedProject = projects.find((p) => p.id === selectedProjectId);
      const res = await apiPost<{ success: boolean; task?: ParsedTask; error?: string; source?: string }>('/ai/tasks/parse', {
        text: nlpText,
        projectName: selectedProject?.name
      });
      if (res.success && res.task) {
        setNlpResult(res.task);
      } else {
        setNlpError(res.error || '解析失败，请手动填写。');
      }
    } catch (err) {
      setNlpError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setNlpLoading(false);
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

  // 标签页按钮样式
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    background: active ? 'rgba(0,243,255,0.15)' : 'transparent',
    border: active ? '1px solid var(--neon-blue)' : '1px solid rgba(255,255,255,0.1)',
    color: active ? 'var(--neon-blue)' : 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'Orbitron, monospace',
    transition: 'all 0.3s ease',
    borderRadius: 0,
  });

  // 模式切换按钮样式
  const modeBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    background: active ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
    border: active ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.2)',
    color: active ? '#00ff88' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 12,
    borderRadius: '4px',
    marginLeft: 8,
  });

  // 通用的 Markdown 渲染区域样式
  const markdownContainerStyle: React.CSSProperties = {
    padding: '16px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    color: '#e0e0e0',
    minHeight: '400px',
    maxHeight: '600px',
    overflowY: 'auto',
    lineHeight: '1.6',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  return (
    <div>
      {/* 目标工作区选择器 */}
      <div className="card" style={{ marginBottom: 16, background: 'rgba(0,15,30,0.6)', borderLeft: '3px solid var(--neon-blue)' }}>
        <div className="form" style={{ gridTemplateColumns: 'minmax(200px, 300px)', alignItems: 'center' }}>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 5, display: 'block', fontFamily: 'Orbitron' }}>
              目标工作区
            </label>
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                onSelectProject(value ? Number(value) : null);
              }}
            >
              {projects.length === 0 && <option value="">暂无项目</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (#{p.id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div style={{ display: 'flex', marginBottom: 0 }}>
        <button style={{ ...tabStyle(activeTab === 'weekly'), borderRadius: '4px 0 0 0' }} onClick={() => setActiveTab('weekly')}>
          📋 周报草稿
        </button>
        <button style={{ ...tabStyle(activeTab === 'progress') }} onClick={() => setActiveTab('progress')}>
          📊 项目进展报告
        </button>
        <button style={{ ...tabStyle(activeTab === 'nlp'), borderRadius: '0 4px 0 0' }} onClick={() => setActiveTab('nlp')}>
          ✍️ 自然语言录入任务
        </button>
      </div>

      {/* 周报草稿 Tab */}
      {activeTab === 'weekly' && (
        <div className="card" style={{ borderTop: '2px solid var(--neon-blue)', borderRadius: '0 4px 4px 4px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={onGenerate}>生成周报草稿</button>
            <button className="btn" type="button" onClick={() => copy(weeklyDraft, setCopiedWeekly)} disabled={!weeklyDraft}>复制全文</button>
            <button className="btn" type="button" onClick={() => download(weeklyDraft, 'weekly-report')} disabled={!weeklyDraft}>下载 TXT</button>
            {copiedWeekly && <span style={{ color: 'var(--neon-green)', lineHeight: '32px', fontSize: 12 }}>已复制</span>}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button style={modeBtnStyle(weeklyViewMode === 'edit')} onClick={() => setWeeklyViewMode('edit')}>📝 编辑源码</button>
              <button style={modeBtnStyle(weeklyViewMode === 'preview')} onClick={() => setWeeklyViewMode('preview')}>👁 渲染预览</button>
            </div>
          </div>

          {/* 模板模式提示：引导用户配置 AI */}
          {aiReportSource === 'template' && weeklyDraft && (
            <div style={{
              marginBottom: 16,
              padding: '12px 16px',
              background: 'rgba(255, 165, 0, 0.12)',
              border: '1px solid rgba(255, 165, 0, 0.5)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#ffaa00', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                  当前为模板模式 — AI 智能分析未启用
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                  前往左侧菜单「⚙ 系统配置」填写 <strong style={{ color: '#fff' }}>AI_API_URL</strong>、<strong style={{ color: '#fff' }}>AI_API_KEY</strong> 和 <strong style={{ color: '#fff' }}>AI_MODEL</strong>，即可启用 AI 深度分析周报。
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
              style={{ width: '100%', fontFamily: 'monospace', lineHeight: '1.5' }}
            />
          ) : (
            <div style={markdownContainerStyle} className="markdown-body">
              {weeklyDraft ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {weeklyDraft}
                </ReactMarkdown>
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 100 }}>暂无报告内容，点击生成即可预览。</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 项目进展报告 Tab */}
      {activeTab === 'progress' && (
        <div className="card" style={{ borderTop: '2px solid #00ff88', borderRadius: '0 4px 4px 4px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={generateProgressReport}
              disabled={!selectedProjectId || generatingProgress}
              style={selectedProjectId ? { borderColor: '#00ff88', color: '#00ff88' } : {}}
            >
              {generatingProgress ? '⏳ 分析中...' : '🤖 AI 生成项目进展报告'}
            </button>
            <button className="btn" type="button" onClick={() => copy(progressDraft, setCopiedProgress)} disabled={!progressDraft}>复制全文</button>
            <button className="btn" type="button" onClick={() => download(progressDraft, 'progress-report')} disabled={!progressDraft}>下载 TXT</button>
            {copiedProgress && <span style={{ color: 'var(--neon-green)', lineHeight: '32px', fontSize: 12 }}>已复制</span>}
            {!selectedProjectId && (
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>请先选择目标工作区</span>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button style={modeBtnStyle(progressViewMode === 'edit')} onClick={() => setProgressViewMode('edit')}>📝 编辑源码</button>
              <button style={modeBtnStyle(progressViewMode === 'preview')} onClick={() => setProgressViewMode('preview')}>👁 渲染预览</button>
            </div>
          </div>

          {progressViewMode === 'edit' ? (
            <textarea
              rows={24}
              value={progressDraft || ''}
              onChange={(e) => setProgressDraft(e.target.value)}
              placeholder="选择目标工作区后，点击按钮生成项目进展分析报告（包含健康度评分、任务进度、预算分析、风险评估和 AI 建议）"
              style={{ width: '100%', fontFamily: 'monospace', lineHeight: '1.6' }}
            />
          ) : (
            <div style={markdownContainerStyle} className="markdown-body">
              {progressDraft ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {progressDraft}
                </ReactMarkdown>
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 100 }}>暂无报告内容，选择项目并点击 AI 生成以预览分析。</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 自然语言录入任务 Tab */}
      {activeTab === 'nlp' && (
        <div className="card" style={{ borderTop: '2px solid #b44dff', borderRadius: '0 4px 4px 4px' }}>
          <div style={{ marginBottom: 14, color: 'var(--text-muted)', fontSize: 12 }}>
            用自然语言描述任务，AI 自动解析为结构化字段。例如：「下周四前张三完成支付接口联调，大概 3 天，优先级很高」
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
            <textarea
              rows={3}
              value={nlpText}
              onChange={(e) => setNlpText(e.target.value)}
              placeholder="在此输入任务描述，支持口语化表达..."
              style={{ flex: 1, fontFamily: 'system-ui', lineHeight: '1.5', resize: 'vertical' }}
            />
            <button
              className="btn"
              type="button"
              disabled={!nlpText.trim() || nlpLoading}
              style={{ borderColor: '#b44dff', color: '#b44dff', alignSelf: 'stretch', minWidth: 100 }}
              onClick={() => void handleNlpParse()}
            >
              {nlpLoading ? '⏳ 解析中...' : '🪄 AI 解析'}
            </button>
          </div>

          {/* 错误提示 */}
          {nlpError && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(255,80,80,0.1)',
              border: '1px solid rgba(255,80,80,0.4)',
              borderRadius: 4,
              color: '#ff8080',
              fontSize: 13,
              marginBottom: 12
            }}>
              ⚠️ {nlpError}
            </div>
          )}

          {/* 解析结果预览 */}
          {nlpResult && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#b44dff', fontFamily: 'Orbitron, monospace', fontSize: 12, marginBottom: 10 }}>
                ✅ 解析成功 — 请核对以下信息后手动创建任务
              </div>
              <table className="table">
                <tbody>
                  {[
                    { label: '任务名称', value: nlpResult.taskName },
                    { label: '负责人', value: nlpResult.assignee || '（未识别）' },
                    { label: '开始日期', value: nlpResult.startDate || '（未识别）' },
                    { label: '截止日期', value: nlpResult.endDate || '（未识别）' },
                    { label: '优先级', value: nlpResult.priority },
                    { label: '状态', value: nlpResult.status },
                    { label: '补充说明', value: nlpResult.notes || '（无）' },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td style={{ width: 100, color: 'var(--text-muted)', fontSize: 12 }}>{label}</td>
                      <td style={{ fontWeight: 500 }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                💡 请将以上信息复制到「需求管理」或「进度同步」模块中手动创建任务。或者您也可以：
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button
                  className="btn"
                  type="button"
                  disabled={creatingFeishu}
                  onClick={() => void handleCreateToFeishu()}
                  style={{
                    background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    width: '100%',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(0, 210, 255, 0.3)'
                  }}
                >
                  {creatingFeishu ? '🚀 正在同步创建至飞书...' : '⚡ 一键创建至飞书同步列表'}
                </button>
              </div>
            </div>
          )}

          {!nlpResult && !nlpError && !nlpLoading && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>
              输入任务描述后点击「AI 解析」，即可自动提取任务字段
            </div>
          )}
        </div>
      )}
    </div>
  );
}
