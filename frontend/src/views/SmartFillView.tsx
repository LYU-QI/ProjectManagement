import { useState } from 'react';
import { apiPost, apiGet } from '../api/client';

interface RequirementResult {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'high' | 'medium' | 'low';
}

interface WorkItemSuggestion {
  title: string;
  type: 'todo' | 'issue';
  estimatedHours: number;
  description: string;
}

interface Requirement {
  id: number;
  title: string;
  description: string;
  status: string;
}

export default function SmartFillView({ projectId, requirements }: { projectId?: number | null; requirements?: Requirement[] }) {
  const [tab, setTab] = useState<'requirement' | 'prd' | 'workitems'>('requirement');
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<RequirementResult | null>(null);
  const [prdContent, setPrdContent] = useState('');
  const [prdLoading, setPrdLoading] = useState(false);
  const [workItems, setWorkItems] = useState<WorkItemSuggestion[]>([]);
  const [workItemsLoading, setWorkItemsLoading] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function generateRequirement() {
    if (!brief.trim()) return;
    setGenerating(true);
    setError('');
    setGenResult(null);
    try {
      const res = await apiPost<RequirementResult>('/smart-fill/requirement', {
        brief: brief.trim(),
        projectId: projectId?.toString()
      });
      setGenResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function generatePrd() {
    if (!selectedReqId) return;
    setPrdLoading(true);
    setError('');
    setPrdContent('');
    try {
      const res = await apiPost<{ content: string }>('/smart-fill/prd', {
        requirementId: selectedReqId
      });
      setPrdContent(res.content);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPrdLoading(false);
    }
  }

  async function suggestWorkItems() {
    if (!selectedReqId || !projectId) {
      setError('请先选择需求和项目');
      return;
    }
    setWorkItemsLoading(true);
    setError('');
    setWorkItems([]);
    try {
      const res = await apiPost<WorkItemSuggestion[]>('/smart-fill/work-items', {
        requirementId: selectedReqId,
        projectId
      });
      setWorkItems(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorkItemsLoading(false);
    }
  }

  return (
    <div>
      <div className="tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button className={`btn ${tab === 'requirement' ? 'primary' : ''}`} onClick={() => setTab('requirement')}>智能需求</button>
        <button className={`btn ${tab === 'prd' ? 'primary' : ''}`} onClick={() => setTab('prd')}>PRD 助手</button>
        <button className={`btn ${tab === 'workitems' ? 'primary' : ''}`} onClick={() => setTab('workitems')}>任务拆分</button>
      </div>

      {error && <p className="warn">{error}</p>}

      {tab === 'requirement' && (
        <div>
          <div className="card">
            <h3>生成需求文档</h3>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              输入功能需求概要，AI 将生成结构化的需求文档。
            </p>
            <textarea
              className="glass-input"
              style={{ width: '100%', minHeight: 100, marginBottom: '0.75rem' }}
              placeholder="例如：用户可以上传头像图片，系统自动裁剪为正方形并支持美颜效果"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
            <button className="btn primary" onClick={generateRequirement} disabled={generating || !brief.trim()}>
              {generating ? '生成中...' : '生成需求'}
            </button>
          </div>

          {genResult && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h3>生成结果</h3>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>需求标题</label>
                <input
                  className="glass-input"
                  style={{ width: '100%' }}
                  value={genResult.title}
                  onChange={(e) => setGenResult({ ...genResult, title: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>需求描述</label>
                <textarea
                  className="glass-input"
                  style={{ width: '100%', minHeight: 80 }}
                  value={genResult.description}
                  onChange={(e) => setGenResult({ ...genResult, description: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>优先级</label>
                <select
                  className="glass-input"
                  value={genResult.priority}
                  onChange={(e) => setGenResult({ ...genResult, priority: e.target.value as 'high' | 'medium' | 'low' })}
                  style={{ width: 'auto' }}
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>验收标准</label>
                {genResult.acceptanceCriteria.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ opacity: 0.5 }}>-</span>
                    <input
                      className="glass-input"
                      style={{ flex: 1 }}
                      value={c}
                      onChange={(e) => {
                        const updated = [...genResult.acceptanceCriteria];
                        updated[i] = e.target.value;
                        setGenResult({ ...genResult, acceptanceCriteria: updated });
                      }}
                    />
                  </div>
                ))}
              </div>
              <button className="btn" onClick={() => setGenResult(null)}>清空结果</button>
            </div>
          )}
        </div>
      )}

      {tab === 'prd' && (
        <div>
          <div className="card">
            <h3>生成 PRD 文档</h3>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              选择一个已有需求，AI 将基于需求内容生成完整的 PRD 文档。
            </p>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '0.2rem' }}>选择需求</label>
              <select
                className="glass-input"
                value={selectedReqId ?? ''}
                onChange={(e) => setSelectedReqId(e.target.value ? Number(e.target.value) : null)}
                style={{ width: '100%' }}
              >
                <option value="">-- 请选择需求 --</option>
                {(requirements || []).map((req) => (
                  <option key={req.id} value={req.id}>
                    #{req.id} {req.title} ({req.status})
                  </option>
                ))}
              </select>
            </div>
            <button className="btn primary" onClick={generatePrd} disabled={prdLoading || !selectedReqId}>
              {prdLoading ? '生成中...' : '生成 PRD'}
            </button>
          </div>

          {prdContent && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3>PRD 内容</h3>
                <button className="btn" onClick={() => navigator.clipboard.writeText(prdContent)}>复制</button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.6, maxHeight: 500, overflow: 'auto', background: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: '0.5rem' }}>
                {prdContent}
              </pre>
            </div>
          )}
        </div>
      )}

      {tab === 'workitems' && (
        <div>
          <div className="card">
            <h3>拆分任务</h3>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              选择一个需求，AI 将把需求拆分为多个可执行的工作项（WorkItem）。
            </p>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '0.2rem' }}>选择需求</label>
              <select
                className="glass-input"
                value={selectedReqId ?? ''}
                onChange={(e) => setSelectedReqId(e.target.value ? Number(e.target.value) : null)}
                style={{ width: '100%' }}
              >
                <option value="">-- 请选择需求 --</option>
                {(requirements || []).map((req) => (
                  <option key={req.id} value={req.id}>
                    #{req.id} {req.title} ({req.status})
                  </option>
                ))}
              </select>
            </div>
            <button className="btn primary" onClick={suggestWorkItems} disabled={workItemsLoading || !selectedReqId}>
              {workItemsLoading ? '拆分中...' : '拆分任务'}
            </button>
          </div>

          {workItems.length > 0 && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h3>建议的工作项</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>标题</th>
                    <th>类型</th>
                    <th>预估工时</th>
                    <th>描述</th>
                  </tr>
                </thead>
                <tbody>
                  {workItems.map((item, i) => (
                    <tr key={i}>
                      <td>{item.title}</td>
                      <td>
                        <span style={{
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.3rem',
                          fontSize: '0.8rem',
                          background: item.type === 'issue' ? 'var(--color-error, red)' : 'var(--color-primary)',
                          color: '#fff'
                        }}>
                          {item.type === 'issue' ? '问题' : '任务'}
                        </span>
                      </td>
                      <td>{item.estimatedHours}h</td>
                      <td style={{ fontSize: '0.85rem' }}>{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem' }}>
                共 {workItems.length} 个工作项，总计约 {workItems.reduce((sum, i) => sum + i.estimatedHours, 0)} 小时
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
