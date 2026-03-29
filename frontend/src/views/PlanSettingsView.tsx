import { useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../api/client';
import { useOrgStore } from '../store/useOrgStore';

interface PlanInfo {
  id: string;
  plan: string;
  maxMembers: number;
  maxProjects?: number;
  features?: string[];
}

const PLAN_OPTIONS = [
  { value: 'FREE', label: '免费版', price: '¥0/月' },
  { value: 'PROFESSIONAL', label: '专业版', price: '¥299/月' },
  { value: 'ENTERPRISE', label: '企业版', price: '联系销售' },
  { value: 'PRO', label: 'Pro', price: '¥99/月' }
];

export default function PlanSettingsView() {
  const { activeOrgId } = useOrgStore();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    if (!activeOrgId) return;
    setLoading(true);
    setError('');
    apiGet<PlanInfo>(`/organizations/${activeOrgId}/plan`)
      .then(setPlan)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [activeOrgId]);

  function submitUpdate(newPlan: string) {
    if (!activeOrgId) return;
    apiPatch(`/organizations/${activeOrgId}/plan`, { name: newPlan })
      .then(() => {
        setMessage('套餐已更新');
        load();
      })
      .catch((e: Error) => setError(e.message));
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>套餐管理</h2>

      {error && <p className="warn">{error}</p>}
      {message && <p style={{ color: 'var(--color-success, green)' }}>{message}</p>}
      {loading && <p>加载中...</p>}

      {plan && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="muted" style={{ fontSize: '0.8rem' }}>当前套餐</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>
              {PLAN_OPTIONS.find((p) => p.value === plan.plan)?.label ?? plan.plan}
            </div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              最大成员数：{plan.maxMembers ?? '无限制'}
              {plan.maxProjects !== undefined && ` | 最大项目数：${plan.maxProjects}`}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {PLAN_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                className="card"
                style={{
                  border: plan.plan === opt.value ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  cursor: plan.plan !== opt.value ? 'pointer' : 'default'
                }}
                onClick={() => {
                  if (plan.plan !== opt.value) submitUpdate(opt.value);
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{opt.label}</div>
                <div className="muted" style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>{opt.price}</div>
                {plan.plan === opt.value && (
                  <div style={{ color: 'var(--color-primary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>当前使用中</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
