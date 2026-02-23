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
  onGenerate: () => void;
  projects: ProjectItem[];
  selectedProjectId: number | null;
  onSelectProject: (id: number | null) => void;
};

export default function AiView({ aiReport, onGenerate, projects, selectedProjectId, onSelectProject }: Props) {
  const [weeklyDraft, setWeeklyDraft] = useState(aiReport);
  const [progressDraft, setProgressDraft] = useState('');
  const [copiedWeekly, setCopiedWeekly] = useState(false);
  const [copiedProgress, setCopiedProgress] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'progress'>('weekly');

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
        <button style={{ ...tabStyle(activeTab === 'progress'), borderRadius: '0 4px 0 0' }} onClick={() => setActiveTab('progress')}>
          📊 项目进展报告
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
    </div>
  );
}
