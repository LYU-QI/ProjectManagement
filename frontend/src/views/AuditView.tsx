import { useMemo, useState } from 'react';
import type { AuditLogItem, ChatbotAuditItem } from '../types';

type Props = {
  auditLogs: AuditLogItem[];
  chatbotAuditLogs: ChatbotAuditItem[];
  onRefresh?: () => void;
};

export default function AuditView({ auditLogs, chatbotAuditLogs, onRefresh }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [onlyMutation, setOnlyMutation] = useState(false);

  const filteredChatbotLogs = useMemo(() => {
    return chatbotAuditLogs.filter((log) => {
      if (onlyFailed && !log.error) return false;
      if (onlyMutation && !['direct', 'react'].includes(log.mode)) return false;
      if (!keyword.trim()) return true;
      const text = `${log.message} ${log.resultContent} ${log.error || ''} ${log.scopedProjectNames.join(' ')}`.toLowerCase();
      return text.includes(keyword.trim().toLowerCase());
    });
  }, [chatbotAuditLogs, keyword, onlyFailed, onlyMutation]);

  const selected = useMemo(() => {
    if (selectedId === null) return null;
    return filteredChatbotLogs.find((item) => item.id === selectedId) || null;
  }, [filteredChatbotLogs, selectedId]);

  const timelineNodes = useMemo(() => {
    if (!selected) return [];
    const traceNodes = (selected.trace || []).map((node, idx) => ({
      id: `trace-${idx}`,
      kind: 'trace' as const,
      title: String(node.step || 'trace'),
      at: String(node.at || ''),
      payload: node
    }));
    const toolNodes = (selected.toolCalls || []).map((node, idx) => ({
      id: `tool-${idx}`,
      kind: 'tool' as const,
      title: String(node.action || node.step || `tool_${idx + 1}`),
      at: String(node.at || ''),
      payload: node
    }));
    return [...traceNodes, ...toolNodes].sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return ta - tb;
    });
  }, [selected]);

  const exportSelectedFlow = () => {
    if (!selected) return;
    const fileName = `chatbot-react-audit-${selected.id}.json`;
    const content = JSON.stringify(selected, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const parseObservation = (value: unknown) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Chatbot 操作审计</h3>
          <button className="btn btn-small" onClick={() => onRefresh?.()}>刷新</button>
        </div>
        <div className="audit-toolbar">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按问题/结果/项目关键词筛选"
          />
          <label className="audit-check">
            <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />
            仅失败
          </label>
          <label className="audit-check">
            <input type="checkbox" checked={onlyMutation} onChange={(e) => setOnlyMutation(e.target.checked)} />
            仅操作类
          </label>
        </div>
        <table className="table table-wrap">
          <thead><tr><th>时间</th><th>用户</th><th>模式</th><th>问题</th><th>结果</th><th>流程</th></tr></thead>
          <tbody>
            {filteredChatbotLogs.map((log) => (
              <tr key={log.id} className={selected?.id === log.id ? 'audit-row-selected' : ''}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.userName || '-'}</td>
                <td><span className={`audit-chip ${log.mode}`}>{log.mode || '-'}</span></td>
                <td>{log.message || '-'}</td>
                <td>
                  {log.error
                    ? <span className="audit-error">失败: {log.error}</span>
                    : (log.resultContent || '-')}
                </td>
                <td><button className="btn btn-small" onClick={() => setSelectedId(log.id)}>查看流程</button></td>
              </tr>
            ))}
            {filteredChatbotLogs.length === 0 && (
              <tr><td colSpan={6} style={{ color: 'var(--text-muted)' }}>暂无 chatbot 操作审计记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0 }}>ReAct 流程可视化（#{selected.id}）</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-small" onClick={exportSelectedFlow}>导出 JSON</button>
              <button className="btn btn-small" onClick={() => setSelectedId(null)}>收起流程</button>
            </div>
          </div>
          <div style={{ marginBottom: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div>问题：{selected.message}</div>
            <div>范围：{selected.detailScope || '-'}</div>
            <div>命中项目：{selected.scopedProjectNames?.join('、') || '-'}</div>
            <div>最终结果：{selected.error ? `失败: ${selected.error}` : selected.resultContent || '-'}</div>
          </div>
          <div className="audit-timeline">
            {timelineNodes.map((node, idx) => (
              <div key={node.id} className="audit-node">
                <div className={`audit-node-dot ${node.kind}`} />
                <div className="audit-node-content">
                  <div className="audit-node-title">
                    <span>{idx + 1}. {node.title}</span>
                    <span className="audit-node-kind">{node.kind === 'tool' ? '工具调用' : '推理节点'}</span>
                  </div>
                  <div className="audit-node-time">{node.at ? new Date(node.at).toLocaleString() : '-'}</div>
                  {node.kind === 'tool' ? (
                    <div className="audit-tool-grid">
                      <div className="audit-tool-block">
                        <div className="audit-tool-label">输入</div>
                        <pre className="audit-node-json">{JSON.stringify((node.payload as Record<string, unknown>).actionInput || {}, null, 2)}</pre>
                      </div>
                      <div className="audit-tool-block">
                        <div className="audit-tool-label">输出</div>
                        <pre className="audit-node-json">{JSON.stringify(parseObservation((node.payload as Record<string, unknown>).observation), null, 2)}</pre>
                      </div>
                    </div>
                  ) : (
                    <pre className="audit-node-json">{JSON.stringify(node.payload, null, 2)}</pre>
                  )}
                </div>
              </div>
            ))}
            {timelineNodes.length === 0 && (
              <div style={{ color: 'var(--text-muted)' }}>该会话没有记录到流程节点。</div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3>系统审计日志</h3>
        <table className="table">
          <thead><tr><th>时间</th><th>用户</th><th>角色</th><th>方法</th><th>路径</th></tr></thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.userName || '-'}</td>
                <td>{log.userRole || '-'}</td>
                <td>{log.method}</td>
                <td>{log.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
