import { useMemo, useState } from 'react';
import type { AuditLogItem, ChatbotAuditItem } from '../types';
import { API_BASE, TOKEN_KEY } from '../api/client';

type Props = {
  auditLogs: AuditLogItem[];
  chatbotAuditLogs: ChatbotAuditItem[];
  onRefresh?: () => void;
};

export default function AuditView({ auditLogs, chatbotAuditLogs, onRefresh }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSystemAuditId, setSelectedSystemAuditId] = useState<number | null>(null);
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

  const selectedSystemAudit = useMemo(() => {
    if (selectedSystemAuditId === null) return null;
    return auditLogs.find((item) => item.id === selectedSystemAuditId) || null;
  }, [auditLogs, selectedSystemAuditId]);

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

  const exportAuditCsv = async () => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const res = await fetch(`${API_BASE}/audit-logs/export`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) {
      throw new Error(`导出审计日志失败（${res.status}）`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
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
    <div className="audit-page">
      <div className="card">
        <div className="audit-head-row">
          <h3 className="audit-title">Chatbot 操作审计</h3>
          <div className="audit-actions">
            <button className="btn btn-small" onClick={() => { void exportAuditCsv(); }}>导出系统审计 CSV</button>
            <button className="btn btn-small" onClick={() => onRefresh?.()}>刷新</button>
          </div>
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
          <thead><tr><th>时间</th><th>用户</th><th>结果</th><th>状态</th><th>模式</th><th>问题</th><th>流程</th></tr></thead>
          <tbody>
            {filteredChatbotLogs.map((log) => (
              <tr key={log.id} className={selected?.id === log.id ? 'audit-row-selected' : ''}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.userName || '-'}</td>
                <td>{log.outcome === 'failed' ? <span className="audit-error">失败</span> : '成功'}</td>
                <td>{log.statusCode ?? '-'}</td>
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
              <tr><td colSpan={7} className="audit-empty-cell">暂无 chatbot 操作审计记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card">
          <div className="audit-head-row">
            <h3 className="audit-title">ReAct 流程可视化（#{selected.id}）</h3>
            <div className="audit-actions">
              <button className="btn btn-small" onClick={exportSelectedFlow}>导出 JSON</button>
              <button className="btn btn-small" onClick={() => setSelectedId(null)}>收起流程</button>
            </div>
          </div>
          <div className="audit-summary">
            <div>问题：{selected.message}</div>
            <div>范围：{selected.detailScope || '-'}</div>
            <div>命中项目：{selected.scopedProjectNames?.join('、') || '-'}</div>
            <div>作用资源：{selected.resourceType || '-'} / {selected.resourceId || '-'}</div>
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
              <div className="audit-empty-text">该会话没有记录到流程节点。</div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3>系统审计日志</h3>
        <table className="table">
          <thead><tr><th>时间</th><th>用户</th><th>角色</th><th>来源</th><th>结果</th><th>状态码</th><th>资源</th><th>方法</th><th>路径</th><th>详情</th></tr></thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.userName || '-'}</td>
                <td>{log.userRole || '-'}</td>
                <td>{log.source || '-'}</td>
                <td>{log.outcome === 'failed' ? <span className="audit-error">失败</span> : '成功'}</td>
                <td>{log.statusCode ?? '-'}</td>
                <td>{[log.resourceType || '-', log.resourceId || '-'].join(' / ')}</td>
                <td>{log.method}</td>
                <td>{log.path}</td>
                <td><button className="btn btn-small" onClick={() => setSelectedSystemAuditId(log.id)}>查看</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSystemAudit && (
        <div className="card">
          <div className="audit-head-row">
            <h3 className="audit-title">系统审计详情（#{selectedSystemAudit.id}）</h3>
            <div className="audit-actions">
              <button className="btn btn-small" onClick={() => setSelectedSystemAuditId(null)}>收起详情</button>
            </div>
          </div>
          <div className="audit-summary">
            <div>来源：{selectedSystemAudit.source || '-'}</div>
            <div>结果：{selectedSystemAudit.outcome === 'failed' ? '失败' : '成功'}</div>
            <div>资源：{selectedSystemAudit.resourceType || '-'} / {selectedSystemAudit.resourceId || '-'}</div>
            <div>错误：{selectedSystemAudit.errorMessage || '-'}</div>
          </div>
          <div className="audit-tool-grid">
            <div className="audit-tool-block">
              <div className="audit-tool-label">变更前</div>
              <pre className="audit-node-json">{JSON.stringify(selectedSystemAudit.beforeSnapshot ?? null, null, 2)}</pre>
            </div>
            <div className="audit-tool-block">
              <div className="audit-tool-label">变更后</div>
              <pre className="audit-node-json">{JSON.stringify(selectedSystemAudit.afterSnapshot ?? null, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
