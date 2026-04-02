import { useState, useEffect } from 'react';
import { apiGet } from '../api/client';

interface ProjectItem {
  id: number;
  name: string;
  alias?: string | null;
}

interface CostReportViewProps {
  projects: ProjectItem[];
  selectedProjectId: number | null;
}

export default function CostReportView({ projects, selectedProjectId }: CostReportViewProps) {
  const [summary, setSummary] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [projectFilter, setProjectFilter] = useState<string>(() =>
    selectedProjectId ? String(selectedProjectId) : 'include_all'
  );

  // Sync with header project selector
  useEffect(() => {
    setProjectFilter(selectedProjectId ? String(selectedProjectId) : 'include_all');
  }, [selectedProjectId]);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      apiGet<any>(`/cost-report/summary?projectId=${projectFilter}&startDate=${startDate}&endDate=${endDate}`),
      apiGet<any[]>(`/cost-report/trend?projectId=${projectFilter}&startDate=${startDate}&endDate=${endDate}&interval=monthly`)
    ])
      .then(([s, t]) => {
        setSummary(s);
        setTrend(Array.isArray(t) ? t : []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function exportCsv() {
    window.open(`/api/v1/cost-report/export?projectId=${projectFilter}&startDate=${startDate}&endDate=${endDate}`, '_blank');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="glass-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <span>至</span>
        <input className="glass-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <select className="glass-input" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="include_all">所有项目</option>
          {projects.map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </select>
        <button className="btn primary" onClick={load}>查询</button>
        <button className="btn" onClick={exportCsv}>导出 CSV</button>
      </div>

      {error && <p className="warn">{error}</p>}
      {loading && <p>加载中...</p>}

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="muted" style={{ fontSize: '0.8rem' }}>人力成本</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>¥{summary.totalLabor?.toLocaleString() ?? 0}</div>
          </div>
          <div className="card">
            <div className="muted" style={{ fontSize: '0.8rem' }}>外包成本</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>¥{summary.totalOutsource?.toLocaleString() ?? 0}</div>
          </div>
          <div className="card">
            <div className="muted" style={{ fontSize: '0.8rem' }}>云服务成本</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>¥{summary.totalCloud?.toLocaleString() ?? 0}</div>
          </div>
          <div className="card" style={{ background: 'var(--color-primary)', color: '#fff' }}>
            <div className="muted" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>总计</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>¥{summary.total?.toLocaleString() ?? 0}</div>
          </div>
        </div>
      )}

      {trend.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>月度趋势</h3>
          <table className="table">
            <thead>
              <tr>
                <th>月份</th>
                <th>人力</th>
                <th>外包</th>
                <th>云服务</th>
                <th>合计</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((row: any) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>¥{row.labor?.toLocaleString() ?? 0}</td>
                  <td>¥{row.outsource?.toLocaleString() ?? 0}</td>
                  <td>¥{row.cloud?.toLocaleString() ?? 0}</td>
                  <td>¥{row.total?.toLocaleString() ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary && summary.byProject?.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>按项目分布</h3>
          <table className="table">
            <thead>
              <tr>
                <th>项目</th>
                <th>人力</th>
                <th>外包</th>
                <th>云服务</th>
                <th>合计</th>
              </tr>
            </thead>
            <tbody>
              {summary.byProject.map((row: any) => (
                <tr key={row.projectId}>
                  <td>{row.projectName}</td>
                  <td>¥{row.labor?.toLocaleString() ?? 0}</td>
                  <td>¥{row.outsource?.toLocaleString() ?? 0}</td>
                  <td>¥{row.cloud?.toLocaleString() ?? 0}</td>
                  <td>¥{row.total?.toLocaleString() ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
