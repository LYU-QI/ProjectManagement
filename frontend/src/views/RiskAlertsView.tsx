import { useMemo } from 'react';
import type { FeishuFormState } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

type Props = {
  rows: Array<FeishuFormState & { recordId: string }>;
  thresholdDays?: number;
  progressThreshold?: number;
};

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseProgress(value: string) {
  if (!value) return 0;
  const num = Number(String(value).replace('%', ''));
  if (!Number.isFinite(num)) return 0;
  return num <= 1 ? num * 100 : num;
}

export default function RiskAlertsView({
  rows,
  thresholdDays = 7,
  progressThreshold = 80
}: Props) {
  const alerts = useMemo(() => {
    const today = new Date();
    return rows
      .filter((row) => row.里程碑 !== '是')
      .map((row) => {
        const end = parseDate(row.截止时间);
        const progress = parseProgress(row.进度);
        const daysLeft = end ? Math.ceil((end.getTime() - today.getTime()) / DAY_MS) : null;
        return { row, end, progress, daysLeft };
      })
      .filter(({ end, daysLeft, progress }) => end && daysLeft !== null && daysLeft <= thresholdDays && progress < progressThreshold)
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  }, [rows, thresholdDays, progressThreshold]);

  return (
    <div className="card risk-alerts-card">
      <h3>延期预警（截止 ≤ {thresholdDays} 天且进度 &lt; {progressThreshold}%）</h3>
      <table className="table">
        <thead><tr><th>任务</th><th>负责人</th><th>截止日期</th><th>剩余天数</th><th>进度</th><th>风险等级</th></tr></thead>
        <tbody>
          {alerts.map(({ row, daysLeft, progress }) => (
            <tr key={row.recordId}>
              <td>{row.任务名称 || row.任务ID}</td>
              <td>{row.负责人 || '-'}</td>
              <td>{row.截止时间 || '-'}</td>
              <td>{daysLeft ?? '-'}</td>
              <td>{progress.toFixed(0)}%</td>
              <td>{row.风险等级 || '-'}</td>
            </tr>
          ))}
          {alerts.length === 0 && (
            <tr><td colSpan={6} className="risk-alerts-empty-cell">暂无延期风险任务</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
