import { useEffect, useMemo, useState } from 'react';
import { createClusterRiskStatus, getClusterRiskBoard, updateClusterRiskStatus, ClusterRiskUpdatePayload } from '../api/clusterRisk';
import AsyncStatePanel from '../components/AsyncStatePanel';
import { ClusterRiskBoardItem, ClusterRiskBoardResponse, ClusterRiskLight } from '../types';

const clusterRiskOptions: ClusterRiskLight[] = ['红灯', '黄灯', '绿灯', '未填'];

function clusterDraftFromItem(item: ClusterRiskBoardItem): ClusterRiskUpdatePayload {
  return {
    projectName: item.projectName,
    projectId: item.projectId,
    ownerOne: item.ownerOne,
    pm: item.pm,
    riskLight: item.riskLight,
    weeklyProgress: item.weeklyProgress,
    dailyRiskHelp: item.dailyRiskHelp,
    riskResolution: item.riskResolution,
    deliveryScope: item.deliveryScope,
    hasKeyDemo: item.hasKeyDemo,
    qualityGap: item.qualityGap,
    qualityLevel: item.qualityLevel
  };
}

function riskToneClass(value: ClusterRiskLight) {
  if (value === '红灯') return 'red';
  if (value === '黄灯') return 'yellow';
  if (value === '绿灯') return 'green';
  return 'empty';
}

type CreateForm = {
  projectName: string;
  projectId: string;
  ownerOne: string;
  pm: string;
  riskLight: ClusterRiskLight;
  deliveryScope: string;
  hasKeyDemo: 'unknown' | 'yes' | 'no';
  weeklyProgress: string;
  dailyRiskHelp: string;
  riskResolution: string;
  qualityGap: string;
  qualityLevel: string;
};

const emptyCreateForm: CreateForm = {
  projectName: '',
  projectId: '',
  ownerOne: '',
  pm: '',
  riskLight: '未填',
  deliveryScope: '',
  hasKeyDemo: 'unknown',
  weeklyProgress: '',
  dailyRiskHelp: '',
  riskResolution: '',
  qualityGap: '',
  qualityLevel: ''
};

export default function ClusterRiskMaintenanceView({ userRole = '' }: { userRole?: string }) {
  const canCreateProject = ['project_manager', 'super_admin'].includes(userRole);
  const canEditAssignmentFields = userRole !== 'pm';
  const [clusterBoard, setClusterBoard] = useState<ClusterRiskBoardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [keyword, setKeyword] = useState('');
  const [drafts, setDrafts] = useState<Record<string, ClusterRiskUpdatePayload>>({});
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);

  async function load(force = false) {
    setLoading(true);
    setError('');
    try {
      const data = await getClusterRiskBoard(force);
      setClusterBoard(data);
      setDrafts(Object.fromEntries((data.items || []).map((item) => [item.recordId, clusterDraftFromItem(item)])));
      if (data.error) setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : '集群风险状态加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleItems = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    const items = clusterBoard?.items || [];
    if (!text) return items;
    return items.filter((item) => `${item.projectName} ${item.projectId} ${item.ownerOne} ${item.pm} ${item.ownerPm} ${item.weeklyProgress} ${item.dailyRiskHelp} ${item.riskResolution}`.toLowerCase().includes(text));
  }, [clusterBoard, keyword]);

  function updateDraft(recordId: string, item: ClusterRiskBoardItem, patch: Partial<ClusterRiskUpdatePayload>) {
    setDrafts((prev) => ({
      ...prev,
      [recordId]: {
        ...(prev[recordId] || clusterDraftFromItem(item)),
        ...patch
      }
    }));
  }

  async function saveItem(item: ClusterRiskBoardItem) {
    const draft = drafts[item.recordId] || clusterDraftFromItem(item);
    setSavingId(item.recordId);
    setError('');
    setMessage('');
    try {
      await updateClusterRiskStatus(item.recordId, draft);
      setMessage(`已更新 ${item.projectName || item.projectId || '项目'} 的集群风险状态`);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '集群风险状态更新失败');
    } finally {
      setSavingId('');
    }
  }

  function setCreateField<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  }

  async function createItem() {
    if (!createForm.projectName.trim() || !createForm.pm.trim()) return;
    setCreating(true);
    setError('');
    setMessage('');
    try {
      await createClusterRiskStatus({
        projectName: createForm.projectName,
        projectId: createForm.projectId,
        ownerOne: createForm.ownerOne,
        pm: createForm.pm,
        riskLight: createForm.riskLight,
        deliveryScope: createForm.deliveryScope,
        hasKeyDemo: createForm.hasKeyDemo === 'unknown' ? null : createForm.hasKeyDemo === 'yes',
        weeklyProgress: createForm.weeklyProgress,
        dailyRiskHelp: createForm.dailyRiskHelp,
        riskResolution: createForm.riskResolution,
        qualityGap: createForm.qualityGap,
        qualityLevel: createForm.qualityLevel
      });
      setMessage(`已新增 ${createForm.projectName} 的集群风险状态`);
      setCreateForm(emptyCreateForm);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增集群风险项目失败');
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="cluster-maintenance-page">
      <div className="page-toolbar-row">
        <button className="btn" type="button" onClick={() => void load(true)} disabled={loading}>
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      {canCreateProject && (
        <section className="card cluster-maintenance-create">
          <div className="section-title-row">
            <h3>新增项目状态</h3>
            <button className="btn primary" type="button" onClick={() => void createItem()} disabled={creating || !createForm.projectName.trim() || !createForm.pm.trim()}>
              {creating ? '新增中...' : '新增项目'}
            </button>
          </div>
          <div className="cluster-maintenance-create-grid">
            <input placeholder="项目名称 *" value={createForm.projectName} onChange={(e) => setCreateField('projectName', e.target.value)} />
            <input placeholder="项目ID（未立项不填）" value={createForm.projectId} onChange={(e) => setCreateField('projectId', e.target.value)} />
            <input placeholder="项目1号位" value={createForm.ownerOne} onChange={(e) => setCreateField('ownerOne', e.target.value)} />
            <input placeholder="PM *" value={createForm.pm} onChange={(e) => setCreateField('pm', e.target.value)} />
            <select value={createForm.riskLight} onChange={(e) => setCreateField('riskLight', e.target.value as ClusterRiskLight)}>
              {clusterRiskOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={createForm.hasKeyDemo} onChange={(e) => setCreateField('hasKeyDemo', e.target.value as CreateForm['hasKeyDemo'])}>
              <option value="unknown">近期重点演示：待确认</option>
              <option value="yes">近期重点演示：是</option>
              <option value="no">近期重点演示：否</option>
            </select>
          </div>
          <div className="cluster-maintenance-create-textareas">
            <textarea placeholder="交付范围" value={createForm.deliveryScope} onChange={(e) => setCreateField('deliveryScope', e.target.value)} />
            <textarea placeholder="周进展（PM）" value={createForm.weeklyProgress} onChange={(e) => setCreateField('weeklyProgress', e.target.value)} />
            <textarea placeholder="Daily 风险求助（PM）" value={createForm.dailyRiskHelp} onChange={(e) => setCreateField('dailyRiskHelp', e.target.value)} />
            <textarea placeholder="风险解决情况" value={createForm.riskResolution} onChange={(e) => setCreateField('riskResolution', e.target.value)} />
            <input placeholder="质量状态与 GAP" value={createForm.qualityGap} onChange={(e) => setCreateField('qualityGap', e.target.value)} />
            <input placeholder="质量等级" value={createForm.qualityLevel} onChange={(e) => setCreateField('qualityLevel', e.target.value)} />
          </div>
        </section>
      )}

      <section className="card cluster-maintenance-panel">
        <div className="section-title-row">
          <h3>项目状态列表</h3>
          <input placeholder="搜索项目 / 1号位 / PM / 风险文本" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        {loading ? (
          <AsyncStatePanel tone="loading" title="正在加载集群风险状态" />
        ) : (
          <div className="cluster-maintenance-list">
            {visibleItems.map((item) => {
              const draft = drafts[item.recordId] || clusterDraftFromItem(item);
              return (
                <article className={`cluster-maintenance-card ${riskToneClass(draft.riskLight as ClusterRiskLight)}`} key={item.recordId || `${item.projectName}-${item.index}`}>
                  <div className="cluster-maintenance-card-head">
                  <div>
                      <strong>{draft.projectName || item.projectName || '未命名项目'}</strong>
                      <span className="muted">{item.projectId || '未立项'} · {item.ownerOne || '未填1号位'} · {item.pm || item.ownerPm || '未填 PM'}</span>
                    </div>
                    <span className={`cluster-risk-badge ${riskToneClass(draft.riskLight as ClusterRiskLight)}`}>{draft.riskLight}</span>
                  </div>
                  <div className="cluster-maintenance-fields">
                    <label>
                      <span>风险灯</span>
                      <select value={draft.riskLight} onChange={(e) => updateDraft(item.recordId, item, { riskLight: e.target.value })}>
                        {clusterRiskOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>近期重点演示</span>
                      <select
                        value={draft.hasKeyDemo === null ? 'unknown' : draft.hasKeyDemo ? 'yes' : 'no'}
                        onChange={(e) => updateDraft(item.recordId, item, { hasKeyDemo: e.target.value === 'unknown' ? null : e.target.value === 'yes' })}
                      >
                        <option value="unknown">待确认</option>
                        <option value="yes">是</option>
                        <option value="no">否</option>
                      </select>
                    </label>
                  </div>
                  <div className="cluster-maintenance-fields">
                    <label>
                      <span>项目名称</span>
                      <input value={draft.projectName} disabled={!canEditAssignmentFields} onChange={(e) => updateDraft(item.recordId, item, { projectName: e.target.value })} />
                    </label>
                    <label>
                      <span>项目ID（未立项不填）</span>
                      <input value={draft.projectId} onChange={(e) => updateDraft(item.recordId, item, { projectId: e.target.value })} />
                    </label>
                  </div>
                  <div className="cluster-maintenance-fields">
                    <label>
                      <span>项目1号位</span>
                      <input value={draft.ownerOne} onChange={(e) => updateDraft(item.recordId, item, { ownerOne: e.target.value })} />
                    </label>
                    <label>
                      <span>PM</span>
                      <input value={draft.pm} disabled={!canEditAssignmentFields} onChange={(e) => updateDraft(item.recordId, item, { pm: e.target.value })} />
                    </label>
                  </div>
                  <label className="cluster-maintenance-field">
                    <span>交付范围</span>
                    <textarea value={draft.deliveryScope} onChange={(e) => updateDraft(item.recordId, item, { deliveryScope: e.target.value })} />
                  </label>
                  <label className="cluster-maintenance-field">
                    <span>周进展（PM）</span>
                    <textarea value={draft.weeklyProgress} onChange={(e) => updateDraft(item.recordId, item, { weeklyProgress: e.target.value })} />
                  </label>
                  <label className="cluster-maintenance-field">
                    <span>Daily 风险求助（PM）</span>
                    <textarea value={draft.dailyRiskHelp} onChange={(e) => updateDraft(item.recordId, item, { dailyRiskHelp: e.target.value })} />
                  </label>
                  <label className="cluster-maintenance-field">
                    <span>风险解决情况</span>
                    <textarea value={draft.riskResolution} onChange={(e) => updateDraft(item.recordId, item, { riskResolution: e.target.value })} />
                  </label>
                  <div className="cluster-maintenance-fields">
                    <label>
                      <span>质量状态与 GAP</span>
                      <input value={draft.qualityGap} onChange={(e) => updateDraft(item.recordId, item, { qualityGap: e.target.value })} />
                    </label>
                    <label>
                      <span>质量等级</span>
                      <input value={draft.qualityLevel} onChange={(e) => updateDraft(item.recordId, item, { qualityLevel: e.target.value })} />
                    </label>
                  </div>
                  <div className="panel-actions">
                    <button className="btn primary" type="button" onClick={() => void saveItem(item)} disabled={!item.recordId || savingId === item.recordId}>
                      {savingId === item.recordId ? '保存中...' : '保存状态'}
                    </button>
                  </div>
                </article>
              );
            })}
            {visibleItems.length === 0 && <AsyncStatePanel tone="empty" title="暂无集群风险项目" />}
          </div>
        )}
      </section>
    </section>
  );
}
