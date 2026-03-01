import { FormEvent, KeyboardEvent, useMemo } from 'react';
import type { DashboardOverview, ProjectItem } from '../types';

type InlineEditState<T, Id> = {
  editingId: Id | null;
  editingField: keyof T | null;
  draft: T | null;
  startEdit: (row: T, field?: keyof T) => void;
  updateDraft: (field: keyof T, value: string) => void;
  hasDirty: (original: T) => boolean;
  finalize: (original: T) => void;
  cancel: () => void;
};

type Props = {
  canWrite: boolean;
  overview: DashboardOverview | null;
  projects: ProjectItem[];
  selectedProjectIds: number[];
  onToggleProjectSelection: (id: number, checked: boolean) => void;
  onDeleteSelectedProjects: () => void;
  onSubmitProject: (e: FormEvent<HTMLFormElement>) => void;
  onDeleteProject: (project: ProjectItem) => void;
  projectEdit: InlineEditState<ProjectItem, number>;
  onSaveProject: (project: ProjectItem) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
};

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString();
}

function healthTone(score: number): 'good' | 'mid' | 'bad' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'mid';
  return 'bad';
}

export default function DashboardView({
  canWrite,
  overview,
  projects,
  selectedProjectIds,
  onToggleProjectSelection,
  onDeleteSelectedProjects,
  onSubmitProject,
  onDeleteProject,
  projectEdit,
  onSaveProject,
  onInlineKeyDown
}: Props) {
  const summary = useMemo(() => {
    const items = overview?.projects || [];
    const totalBudget = items.reduce((sum, item) => sum + (item.budget || 0), 0);
    const totalActual = items.reduce((sum, item) => sum + (item.actualCost || 0), 0);
    const blocked = items.reduce((sum, item) => sum + item.blockedTasks, 0);
    const avgHealth = items.length > 0 ? Math.round(items.reduce((sum, item) => sum + item.healthScore, 0) / items.length) : 0;
    return {
      totalBudget,
      totalActual,
      blocked,
      avgHealth,
      varianceRate: totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0
    };
  }, [overview]);

  const topRiskProjects = useMemo(() => {
    return [...(overview?.projects || [])].sort((a, b) => a.healthScore - b.healthScore).slice(0, 5);
  }, [overview]);

  const visibleProjectBudgets = useMemo(() => {
    return [...(overview?.projects || [])].sort((a, b) => a.projectId - b.projectId);
  }, [overview]);

  return (
    <div>
      {canWrite && (
        <div className="card compact-card dashboard-create-card">
          <div className="section-title-row">
            <h3>快速创建项目</h3>
            <span className="muted">填写基础信息后可在需求页继续完善</span>
          </div>
          <form className="form new-project-form" onSubmit={onSubmitProject}>
            <input name="name" placeholder="项目名称" required />
            <input name="alias" placeholder="项目别名（大写英文）" required />
            <input name="budget" type="number" step="0.01" placeholder="预算" required />
            <input name="startDate" type="date" />
            <input name="endDate" type="date" />
            <input name="feishuChatIds" placeholder="飞书群 ChatID（逗号分隔）" />
            <input name="feishuAppToken" placeholder="飞书多维表格 App Token（可选）" />
            <input name="feishuTableId" placeholder="飞书多维表格 Table ID（可选）" />
            <button className="btn btn-primary" type="submit">新增项目</button>
          </form>
        </div>
      )}

      <section className="metrics-grid">
        <article className="metric-card">
          <p className="metric-label">项目总数</p>
          <p className="metric-value">{overview?.summary.projectCount ?? 0}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">高风险项目</p>
          <p className="metric-value danger">{overview?.summary.riskProjectCount ?? 0}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">阻塞任务</p>
          <p className="metric-value warning">{summary.blocked}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">预算使用率</p>
          <p className="metric-value">{summary.varianceRate}%</p>
          <div className="progress-track">
            <div className={`progress-fill ${summary.varianceRate > 100 ? 'danger' : 'good'}`} style={{ width: `${Math.min(summary.varianceRate, 100)}%` }} />
          </div>
        </article>
      </section>

      <section className="dashboard-panels dashboard-panels-gap">
        <article className="card compact-card">
          <div className="section-title-row">
            <h3>风险优先项目</h3>
            <span className="muted">按健康分从低到高</span>
          </div>
          <div className="risk-rank-list">
            {topRiskProjects.length === 0 && <p className="muted">暂无数据</p>}
            {topRiskProjects.map((project, index) => (
              <div key={project.projectId} className="risk-rank-row">
                <span className="risk-rank-index">{index + 1}</span>
                <div className="risk-rank-main">
                  <strong>{project.projectName}</strong>
                  <span className="muted">阻塞 {project.blockedTasks} · 偏差 {project.varianceRate}%</span>
                </div>
                <span className={`health-pill ${healthTone(project.healthScore)}`}>健康度 {project.healthScore}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card compact-card">
          <div className="section-title-row">
            <h3>预算概览</h3>
            <span className="muted">跨项目累计</span>
          </div>
          <div className="budget-kpis">
            <div>
              <p className="metric-label">总预算</p>
              <p className="metric-value">¥{formatMoney(summary.totalBudget)}</p>
            </div>
            <div>
              <p className="metric-label">总实际</p>
              <p className={`metric-value ${summary.totalActual > summary.totalBudget ? 'danger' : 'good'}`}>
                ¥{formatMoney(summary.totalActual)}
              </p>
            </div>
            <div>
              <p className="metric-label">平均健康度</p>
              <p className="metric-value">{summary.avgHealth}</p>
            </div>
          </div>
          <div className="dashboard-budget-detail">
            {visibleProjectBudgets.length > 0 ? (
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>项目</th>
                    <th>预算</th>
                    <th>实际</th>
                    <th>偏差</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProjectBudgets.map((item) => (
                    <tr key={`budget-${item.projectId}`}>
                      <td>{item.projectName}</td>
                      <td>¥{formatMoney(item.budget)}</td>
                      <td className={item.actualCost > item.budget ? 'danger' : 'good'}>¥{formatMoney(item.actualCost)}</td>
                      <td className={item.varianceRate > 0 ? 'danger' : 'good'}>{item.varianceRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">暂无可见项目预算数据。</p>
            )}
          </div>
        </article>
      </section>

      <div className="card req-mt-12">
        <div className="section-title-row">
          <h3>项目管理</h3>
          {canWrite && (
            <button className="btn" type="button" disabled={selectedProjectIds.length === 0} onClick={onDeleteSelectedProjects}>
              批量删除 ({selectedProjectIds.length})
            </button>
          )}
        </div>

        <table className="table">
          <thead>
            <tr>
              {canWrite && (
                <th>
                  <input
                    type="checkbox"
                    checked={projects.length > 0 && selectedProjectIds.length === projects.length}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      projects.forEach((project) => onToggleProjectSelection(project.id, checked));
                    }}
                  />
                </th>
              )}
              <th>ID</th>
              <th>名称</th>
              <th>别名</th>
              <th>预算</th>
              <th>开始</th>
              <th>结束</th>
              <th>群聊 ChatID</th>
              <th>飞书 App Token</th>
              <th>飞书 Table ID</th>
              {canWrite && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const isEditing = projectEdit.editingId === project.id;
              const rowDraft = isEditing ? (projectEdit.draft ?? project) : project;
              const isDirty = isEditing && projectEdit.hasDirty(project);

              return (
                <tr key={project.id} className={isEditing ? 'editing-row' : ''}>
                  {canWrite && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={(e) => onToggleProjectSelection(project.id, e.target.checked)}
                      />
                    </td>
                  )}
                  <td>{project.id}</td>

                  <td
                    className={isEditing && projectEdit.editingField === 'name' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'name')}
                  >
                    {isEditing && projectEdit.editingField === 'name' ? (
                      <input
                        data-project-edit={`${project.id}-name`}
                        value={rowDraft.name ?? ''}
                        onChange={(e) => projectEdit.updateDraft('name', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.name
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'alias' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'alias')}
                  >
                    {isEditing && projectEdit.editingField === 'alias' ? (
                      <input
                        data-project-edit={`${project.id}-alias`}
                        value={rowDraft.alias ?? ''}
                        onChange={(e) => projectEdit.updateDraft('alias', e.target.value.toUpperCase())}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.alias || '-'
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'budget' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'budget')}
                  >
                    {isEditing && projectEdit.editingField === 'budget' ? (
                      <input
                        data-project-edit={`${project.id}-budget`}
                        type="number"
                        step="0.01"
                        value={rowDraft.budget ?? ''}
                        onChange={(e) => projectEdit.updateDraft('budget', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.budget
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'startDate' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'startDate')}
                  >
                    {isEditing && projectEdit.editingField === 'startDate' ? (
                      <input
                        data-project-edit={`${project.id}-startDate`}
                        type="date"
                        value={rowDraft.startDate ?? ''}
                        onChange={(e) => projectEdit.updateDraft('startDate', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.startDate || '-'
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'endDate' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'endDate')}
                  >
                    {isEditing && projectEdit.editingField === 'endDate' ? (
                      <input
                        data-project-edit={`${project.id}-endDate`}
                        type="date"
                        value={rowDraft.endDate ?? ''}
                        onChange={(e) => projectEdit.updateDraft('endDate', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.endDate || '-'
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'feishuChatIds' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'feishuChatIds')}
                  >
                    {isEditing && projectEdit.editingField === 'feishuChatIds' ? (
                      <input
                        data-project-edit={`${project.id}-feishuChatIds`}
                        value={rowDraft.feishuChatIds ?? ''}
                        onChange={(e) => projectEdit.updateDraft('feishuChatIds', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.feishuChatIds || '-'
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'feishuAppToken' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'feishuAppToken')}
                  >
                    {isEditing && projectEdit.editingField === 'feishuAppToken' ? (
                      <input
                        data-project-edit={`${project.id}-feishuAppToken`}
                        value={rowDraft.feishuAppToken ?? ''}
                        onChange={(e) => projectEdit.updateDraft('feishuAppToken', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.feishuAppToken
                        ? <span title={rowDraft.feishuAppToken ?? ''}>已配置</span>
                        : <span className="muted">-</span>
                    )}
                  </td>

                  <td
                    className={isEditing && projectEdit.editingField === 'feishuTableId' ? 'editing' : ''}
                    onDoubleClick={() => canWrite && projectEdit.startEdit(project, 'feishuTableId')}
                  >
                    {isEditing && projectEdit.editingField === 'feishuTableId' ? (
                      <input
                        data-project-edit={`${project.id}-feishuTableId`}
                        value={rowDraft.feishuTableId ?? ''}
                        onChange={(e) => projectEdit.updateDraft('feishuTableId', e.target.value)}
                        onKeyDown={(e) => onInlineKeyDown(e, () => onSaveProject(project), projectEdit.cancel)}
                        onBlur={() => projectEdit.finalize(project)}
                      />
                    ) : (
                      rowDraft.feishuTableId
                        ? <span title={rowDraft.feishuTableId ?? ''}>已配置</span>
                        : <span className="muted">-</span>
                    )}
                  </td>

                  {canWrite && (
                    <td className="req-inline-actions">
                      {isEditing && isDirty ? (
                        <>
                          <button className="btn" type="button" onClick={() => onSaveProject(project)}>
                            保存
                          </button>
                          <button className="btn" type="button" onClick={projectEdit.cancel}>
                            取消
                          </button>
                        </>
                      ) : (
                        <button className="btn" type="button" onClick={() => onDeleteProject(project)}>
                          删除
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
