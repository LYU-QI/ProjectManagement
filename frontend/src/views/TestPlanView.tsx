import { useEffect, useMemo, useState } from 'react';
import AsyncStatePanel from '../components/AsyncStatePanel';
import ThemedSelect from '../components/ui/ThemedSelect';
import {
  addTestCases, createTestCase, createTestPlan, deleteTestCase, deleteTestPlan,
  executeTestCase, getTestPlan, listTestCases, listTestPlans, updateTestCase, updateTestPlan,
  type TestCase, type TestCasePriority, type TestCaseStatus,
  type TestPlan, type TestPlanStatus
} from '../api/testhub';

type Props = {
  selectedProjectId: number | null;
  canWrite: boolean;
  feishuUserNames: string[];
};

const STATUS_OPTIONS: { value: TestPlanStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
];
const STATUS_LABELS: Record<TestPlanStatus, string> = {
  draft: '草稿', active: '进行中', completed: '已完成', archived: '已归档'
};
const STATUS_COLOR: Record<TestPlanStatus, string> = {
  draft: '#9ca3af', active: '#3b82f6', completed: '#10b981', archived: '#6b7280'
};

const CASE_STATUS_OPTIONS: { value: TestCaseStatus | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '启用中' },
  { value: 'deprecated', label: '废弃' },
];

const CASE_STATUS_LABELS: Record<TestCaseStatus, string> = {
  draft: '草稿',
  active: '启用中',
  deprecated: '废弃',
};
const CASE_PRIORITY_OPTIONS: { value: TestCasePriority | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'critical', label: '紧急' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];
const CASE_PRIORITY_LABELS: Record<TestCasePriority, string> = {
  critical: '紧急', high: '高', medium: '中', low: '低'
};

const RESULT_OPTIONS = [
  { value: 'passed', label: '通过', color: '#10b981' },
  { value: 'failed', label: '失败', color: '#ef4444' },
  { value: 'blocked', label: '阻塞', color: '#f59e0b' },
  { value: 'skipped', label: '跳过', color: '#9ca3af' },
];

const PAGE_SIZE = 20;

export default function TestPlanView({ selectedProjectId, canWrite, feishuUserNames }: Props) {
  const [activeTab, setActiveTab] = useState<'plans' | 'cases'>('plans');
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [planTotal, setPlanTotal] = useState(0);
  const [planPage, setPlanPage] = useState(1);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [caseTotal, setCaseTotal] = useState(0);
  const [casePage, setCasePage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [planStatusFilter, setPlanStatusFilter] = useState<TestPlanStatus | ''>('');
  const [caseStatusFilter, setCaseStatusFilter] = useState<TestCaseStatus | ''>('');
  const [casePriorityFilter, setCasePriorityFilter] = useState<TestCasePriority | ''>('');
  const [search, setSearch] = useState('');

  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null);
  const [planDetail, setPlanDetail] = useState<TestPlan | null>(null);
  const [addingCases, setAddingCases] = useState(false);
  const [planForm, setPlanForm] = useState({ title: '', description: '', status: 'draft' as TestPlanStatus, startDate: '', endDate: '' });
  const [caseForm, setCaseForm] = useState({ title: '', description: '', preconditions: '', steps: '', expectedResult: '', priority: 'medium' as TestCasePriority, status: 'draft' as TestCaseStatus, tags: '' });

  const planPages = Math.max(1, Math.ceil(planTotal / PAGE_SIZE));
  const casePages = Math.max(1, Math.ceil(caseTotal / PAGE_SIZE));

  async function loadPlans(p = 1) {
    if (!selectedProjectId) { setPlans([]); setPlanTotal(0); return; }
    setLoading(true);
    try {
      const res = await listTestPlans({ projectId: selectedProjectId, status: planStatusFilter || undefined, search: search || undefined, page: p, pageSize: PAGE_SIZE });
      setPlans(res.items);
      setPlanTotal(res.total);
      setPlanPage(p);
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }

  async function loadCases(p = 1) {
    if (!selectedProjectId) { setCases([]); setCaseTotal(0); return; }
    setLoading(true);
    try {
      const res = await listTestCases({ projectId: selectedProjectId, status: caseStatusFilter || undefined, priority: casePriorityFilter || undefined, search: search || undefined, page: p, pageSize: PAGE_SIZE });
      setCases(res.items);
      setCaseTotal(res.total);
      setCasePage(p);
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (activeTab === 'plans') void loadPlans(1);
    else void loadCases(1);
  }, [selectedProjectId, planStatusFilter, caseStatusFilter, casePriorityFilter, search, activeTab]);

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !planForm.title.trim()) return;
    try {
      if (editingPlan) {
        await updateTestPlan(editingPlan.id, { title: planForm.title, description: planForm.description || undefined, status: planForm.status, startDate: planForm.startDate || undefined, endDate: planForm.endDate || undefined });
        setMessage('测试计划已更新');
      } else {
        await createTestPlan({ projectId: selectedProjectId, title: planForm.title, description: planForm.description || undefined, status: planForm.status, startDate: planForm.startDate || undefined, endDate: planForm.endDate || undefined });
        setMessage('测试计划已创建');
      }
      setShowCreatePlan(false);
      setEditingPlan(null);
      void loadPlans(1);
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); }
  }

  async function handleCreateCase(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !caseForm.title.trim()) return;
    try {
      await createTestCase({ projectId: selectedProjectId, title: caseForm.title, description: caseForm.description || undefined, preconditions: caseForm.preconditions || undefined, steps: caseForm.steps ? [{ content: caseForm.steps }] : undefined, expectedResult: caseForm.expectedResult || undefined, priority: caseForm.priority, status: caseForm.status, tags: caseForm.tags || undefined });
      setMessage('测试用例已创建');
      setShowCreateCase(false);
      void loadCases(1);
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); }
  }

  async function openPlanDetail(plan: TestPlan) {
    try {
      const detail = await getTestPlan(plan.id);
      setPlanDetail(detail);
      setAddingCases(false);
    } catch (e) { setError(e instanceof Error ? e.message : '加载详情失败'); }
  }

  async function handleExecuteCase(item: { id: number; testCaseId: number }, result: string) {
    if (!planDetail) return;
    try {
      await executeTestCase(planDetail.id, item.testCaseId, { result: result as 'passed' | 'failed' | 'blocked' | 'skipped' });
      setMessage(`用例已标记为${RESULT_OPTIONS.find(r => r.value === result)?.label}`);
      // Refresh detail
      const detail = await getTestPlan(planDetail.id);
      setPlanDetail(detail);
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); }
  }

  async function handleAddCases() {
    if (!planDetail || !selectedProjectId) return;
    try {
      // Get all enabled test cases for this project that aren't in the plan yet
      const available = cases.filter(c => c.status !== 'deprecated');
      const existingIds = new Set(planDetail.items?.map(i => i.testCaseId) ?? []);
      const toAdd = available.map(c => c.id).filter(id => !existingIds.has(id));
      if (toAdd.length === 0) { setError('没有可添加的用例'); return; }
      await addTestCases(planDetail.id, toAdd);
      setMessage(`已添加 ${toAdd.length} 个用例`);
      setAddingCases(false);
      const detail = await getTestPlan(planDetail.id);
      setPlanDetail(detail);
    } catch (e) { setError(e instanceof Error ? e.message : '添加失败'); }
  }

  async function handleDeletePlan(plan: TestPlan) {
    if (!window.confirm(`删除测试计划「${plan.title}」？`)) return;
    try {
      await deleteTestPlan(plan.id);
      setMessage('已删除');
      void loadPlans(planPage);
    } catch (e) { setError(e instanceof Error ? e.message : '删除失败'); }
  }

  async function handleDeleteCase(tc: TestCase) {
    if (!window.confirm(`删除测试用例「${tc.title}」？`)) return;
    try {
      await deleteTestCase(tc.id);
      setMessage('已删除');
      void loadCases(casePage);
    } catch (e) { setError(e instanceof Error ? e.message : '删除失败'); }
  }

  function getResultColor(result?: string | null) {
    if (!result) return 'inherit';
    const opt = RESULT_OPTIONS.find(r => r.value === result);
    return opt?.color ?? 'inherit';
  }

  return (
    <div>
      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button className={`btn ${activeTab === 'plans' ? 'primary' : ''}`} onClick={() => setActiveTab('plans')}>测试计划</button>
        <button className={`btn ${activeTab === 'cases' ? 'primary' : ''}`} onClick={() => setActiveTab('cases')}>测试用例</button>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {activeTab === 'plans' && (
          <ThemedSelect value={planStatusFilter} onChange={e => setPlanStatusFilter(e.target.value as TestPlanStatus | '')}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </ThemedSelect>
        )}
        {activeTab === 'cases' && (
          <>
            <ThemedSelect value={caseStatusFilter} onChange={e => setCaseStatusFilter(e.target.value as TestCaseStatus | '')}>
              {CASE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </ThemedSelect>
            <ThemedSelect value={casePriorityFilter} onChange={e => setCasePriorityFilter(e.target.value as TestCasePriority | '')}>
              {CASE_PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </ThemedSelect>
          </>
        )}
        <input className="glass-input" placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        {canWrite && selectedProjectId && (
          activeTab === 'plans'
            ? <button className="btn primary" onClick={() => { setEditingPlan(null); setPlanForm({ title: '', description: '', status: 'draft', startDate: '', endDate: '' }); setShowCreatePlan(true); }}>+ 新建计划</button>
            : <button className="btn primary" onClick={() => setShowCreateCase(true)}>+ 新建用例</button>
        )}
      </div>

      {/* Create Plan Form */}
      {showCreatePlan && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '0.75rem', border: '1px solid var(--color-border-strong)' }}>
          <h3 style={{ marginBottom: '1rem' }}>{editingPlan ? '编辑测试计划' : '新建测试计划'}</h3>
          <form onSubmit={handleCreatePlan}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>标题 *</label>
                <input className="glass-input" value={planForm.title} onChange={e => setPlanForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>状态</label>
                <ThemedSelect value={planForm.status} onChange={e => setPlanForm(f => ({ ...f, status: e.target.value as TestPlanStatus }))}>
                  {STATUS_OPTIONS.filter(o => o.value).map(o => <option key={o.value!} value={o.value}>{o.label}</option>)}
                </ThemedSelect>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>开始日期</label>
                <input className="glass-input" type="date" value={planForm.startDate} onChange={e => setPlanForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>结束日期</label>
                <input className="glass-input" type="date" value={planForm.endDate} onChange={e => setPlanForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>描述</label>
              <textarea className="glass-input" rows={2} value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn primary">{loading ? '提交中...' : '提交'}</button>
              <button type="button" className="btn" onClick={() => setShowCreatePlan(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      {/* Create Case Form */}
      {showCreateCase && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '0.75rem', border: '1px solid var(--color-border-strong)' }}>
          <h3 style={{ marginBottom: '1rem' }}>新建测试用例</h3>
          <form onSubmit={handleCreateCase}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>标题 *</label>
                <input className="glass-input" value={caseForm.title} onChange={e => setCaseForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>优先级</label>
                <ThemedSelect value={caseForm.priority} onChange={e => setCaseForm(f => ({ ...f, priority: e.target.value as TestCasePriority }))}>
                  {CASE_PRIORITY_OPTIONS.filter(o => o.value).map(o => <option key={o.value!} value={o.value}>{o.label}</option>)}
                </ThemedSelect>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>状态</label>
                <ThemedSelect value={caseForm.status} onChange={e => setCaseForm(f => ({ ...f, status: e.target.value as TestCaseStatus }))}>
                  {CASE_STATUS_OPTIONS.filter(o => o.value).map(o => <option key={o.value!} value={o.value}>{o.label}</option>)}
                </ThemedSelect>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>标签</label>
                <input className="glass-input" placeholder="逗号分隔" value={caseForm.tags} onChange={e => setCaseForm(f => ({ ...f, tags: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>前置条件</label>
              <textarea className="glass-input" rows={2} value={caseForm.preconditions} onChange={e => setCaseForm(f => ({ ...f, preconditions: e.target.value }))} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>测试步骤</label>
              <textarea className="glass-input" rows={2} placeholder="每行一个步骤" value={caseForm.steps} onChange={e => setCaseForm(f => ({ ...f, steps: e.target.value }))} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.25rem' }}>预期结果</label>
              <textarea className="glass-input" rows={2} value={caseForm.expectedResult} onChange={e => setCaseForm(f => ({ ...f, expectedResult: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn primary">{loading ? '提交中...' : '提交'}</button>
              <button type="button" className="btn" onClick={() => setShowCreateCase(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      {/* Plan Detail Panel */}
      {planDetail && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '0.75rem', border: '1px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>测试计划: {planDetail.title}</h3>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.8rem', opacity: 0.6 }}>
                <span>状态: {STATUS_LABELS[planDetail.status]}</span>
                {planDetail.startDate && <span>开始: {planDetail.startDate}</span>}
                {planDetail.endDate && <span>截止: {planDetail.endDate}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {canWrite && (
                <button className="btn" onClick={() => setAddingCases(true)}>+ 添加用例</button>
              )}
              <button className="btn" onClick={() => setPlanDetail(null)}>关闭</button>
            </div>
          </div>

          {addingCases && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-bg-muted)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                将添加 {cases.filter(c => c.status !== 'deprecated').length} 个启用中的用例到本计划。
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn primary" onClick={() => void handleAddCases()}>确认添加</button>
                <button className="btn" onClick={() => setAddingCases(false)}>取消</button>
              </div>
            </div>
          )}

          <table className="table">
            <thead>
              <tr>
                <th>用例标题</th>
                <th>优先级</th>
                <th>状态</th>
                <th>执行结果</th>
                <th>执行时间</th>
                {canWrite && <th>操作</th>}
              </tr>
            </thead>
            <tbody>
              {planDetail.items?.map(item => (
                <tr key={item.id}>
                  <td>{item.testCase.title}</td>
                  <td style={{ fontSize: '0.8rem' }}>{CASE_PRIORITY_LABELS[item.testCase.priority]}</td>
                  <td style={{ fontSize: '0.8rem', opacity: 0.6 }}>{CASE_STATUS_LABELS[item.testCase.status]}</td>
                  <td>
                    {canWrite ? (
                      <ThemedSelect
                        value={item.result ?? ''}
                        onChange={e => void handleExecuteCase(item, e.target.value)}
                        style={{ color: getResultColor(item.result), fontWeight: 600 }}
                      >
                        <option value="">待执行</option>
                        {RESULT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </ThemedSelect>
                    ) : (
                      <span style={{ color: getResultColor(item.result), fontWeight: 600 }}>
                        {item.result ? RESULT_OPTIONS.find(r => r.value === item.result)?.label : '待执行'}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                    {item.executedAt ? new Date(item.executedAt).toLocaleString('zh-CN') : '-'}
                  </td>
                  {canWrite && <td style={{ fontSize: '0.8rem' }}>-</td>}
                </tr>
              ))}
              {(!planDetail.items || planDetail.items.length === 0) && (
                <tr><td colSpan={6} style={{ textAlign: 'center', opacity: 0.5, padding: '1rem' }}>暂无用例</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {error && <div className="card warn" style={{ marginBottom: '0.75rem', padding: '0.75rem' }}>{error}</div>}
      {message && <div className="card" style={{ marginBottom: '0.75rem', padding: '0.75rem', borderColor: 'var(--color-primary)' }}>{message}</div>}

      {/* Plans List */}
      {activeTab === 'plans' && (
        loading ? (
          <AsyncStatePanel
            tone="loading"
            title="正在加载测试计划"
            description="正在同步当前项目下的测试计划与关联用例。"
          />
        )
        : !selectedProjectId ? <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>请先选择一个项目</div>
        : plans.length === 0 ? <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>暂无测试计划</div>
        : <div className="glass-card" style={{ padding: 0 }}>
          <table className="table" style={{ margin: 0 }}>
            <thead><tr><th>ID</th><th>标题</th><th>状态</th><th>用例数</th><th>开始</th><th>截止</th>{canWrite && <th>操作</th>}</tr></thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id} style={{ cursor: 'pointer' }} onClick={() => void openPlanDetail(plan)}>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>#{plan.id}</td>
                  <td>{plan.title}</td>
                  <td><span style={{ color: STATUS_COLOR[plan.status], fontWeight: 600 }}>{STATUS_LABELS[plan.status]}</span></td>
                  <td>{plan.caseCount ?? '-'}</td>
                  <td style={{ fontSize: '0.8rem', opacity: 0.6 }}>{plan.startDate || '-'}</td>
                  <td style={{ fontSize: '0.8rem', opacity: 0.6 }}>{plan.endDate || '-'}</td>
                  {canWrite && (
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="btn" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', background: 'transparent' }}
                          onClick={() => { setEditingPlan(plan); setPlanForm({ title: plan.title, description: plan.description ?? '', status: plan.status, startDate: plan.startDate ?? '', endDate: plan.endDate ?? '' }); setShowCreatePlan(true); }}>
                          编辑
                        </button>
                        <button className="btn" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                          onClick={() => void handleDeletePlan(plan)}>
                          删除
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {planPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}>
              <button className="btn" disabled={planPage <= 1} onClick={() => void loadPlans(planPage - 1)}>上一页</button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', opacity: 0.7 }}>第 {planPage} / {planPages} 页</span>
              <button className="btn" disabled={planPage >= planPages} onClick={() => void loadPlans(planPage + 1)}>下一页</button>
            </div>
          )}
        </div>
      )}

      {/* Cases List */}
      {activeTab === 'cases' && (
        loading ? (
          <AsyncStatePanel
            tone="loading"
            title="正在加载测试用例"
            description="正在同步当前项目下的测试用例、优先级与状态信息。"
          />
        )
        : !selectedProjectId ? <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>请先选择一个项目</div>
        : cases.length === 0 ? <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>暂无测试用例</div>
        : <div className="glass-card" style={{ padding: 0 }}>
          <table className="table" style={{ margin: 0 }}>
            <thead><tr><th>ID</th><th>标题</th><th>优先级</th><th>状态</th><th>标签</th><th>创建时间</th>{canWrite && <th>操作</th>}</tr></thead>
            <tbody>
              {cases.map(tc => (
                <tr key={tc.id}>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>#{tc.id}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{tc.title}</div>
                    {tc.description && <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{tc.description.slice(0, 60)}{tc.description.length > 60 ? '...' : ''}</div>}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{CASE_PRIORITY_LABELS[tc.priority]}</td>
                  <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>{CASE_STATUS_LABELS[tc.status]}</td>
                  <td style={{ fontSize: '0.75rem', opacity: 0.5 }}>{tc.tags || '-'}</td>
                  <td style={{ fontSize: '0.8rem', opacity: 0.6 }}>{new Date(tc.createdAt).toLocaleDateString('zh-CN')}</td>
                  {canWrite && (
                    <td>
                      <button className="btn" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                        onClick={() => void handleDeleteCase(tc)}>
                        删除
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {casePages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}>
              <button className="btn" disabled={casePage <= 1} onClick={() => void loadCases(casePage - 1)}>上一页</button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', opacity: 0.7 }}>第 {casePage} / {casePages} 页</span>
              <button className="btn" disabled={casePage >= casePages} onClick={() => void loadCases(casePage + 1)}>下一页</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
