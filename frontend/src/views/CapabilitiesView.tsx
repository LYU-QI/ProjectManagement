import { useEffect, useMemo, useState } from 'react';
import { listCapabilityTemplates, saveCapabilityTemplate } from '../api/capabilities';

type Props = {
  canWrite: boolean;
  selectedProjectId: number | null;
  selectedProjectName: string;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
};

const WEEKLY_REPORT_SCENE = 'ai.weekly-report';
const DEFAULT_TEMPLATE_NAME = '管理层周报模板';
const DEFAULT_SYSTEM_PROMPT = `你是资深 PMO 总监。基于输入的项目周度量化数据，生成可直接给管理层汇报的 Markdown 周报。

硬性要求：
1. 结论必须引用输入表格中的具体指标，不要泛泛描述，不要编造数据。
2. 百分比指标用文本进度条辅助展示，如 ██████░░░░ 60%。
3. 如果测试数据为空，写“当前项目暂无测试执行数据”。
4. 不输出任何成本、预算、支出、工时成本、预算偏差相关内容。
5. 只输出 Markdown，不输出图片或 Mermaid。

必须输出章节：
## 📊 本周总览
## 📈 项目健康量化表
## 🧪 测试质量量化表
## ⚠️ 风险预警与根因分析
## 🎯 管理层行动建议
## 📋 下周重点事项

重点分析严重缺陷、测试阻塞、任务阻塞、需求频繁变更；管理动作要具体到责任方和建议完成时间。`;
const DEFAULT_USER_PROMPT_TEMPLATE = `报告周期：{{weekStart}} 至 {{weekEnd}}
项目：{{projectNames}}
是否包含风险分析：{{includeRisks}}

项目健康量化表：
{{healthTable}}

测试质量量化表：
{{testQualityTable}}

以下是项目明细：

{{detailBlocks}}

请基于上述量化数据输出一份面向管理层的高质量周报。所有判断必须引用表格中的具体指标。`;
const PM_ASSISTANT_JOBS = [
  { id: 'morning-briefing', name: '早间播报' },
  { id: 'meeting-materials', name: '会议材料准备' },
  { id: 'risk-alerts', name: '风险预警' },
  { id: 'overdue-reminder', name: '超期任务提醒' },
  { id: 'milestone-reminder', name: '里程碑提醒' },
  { id: 'blocked-alert', name: '阻塞任务预警' },
  { id: 'resource-load', name: '资源负载分析' },
  { id: 'progress-board', name: '进度看板' },
  { id: 'trend-predict', name: '任务趋势预测' },
  { id: 'weekly-agenda', name: '周会讨论要点' },
  { id: 'daily-report', name: '晚间日报' },
  { id: 'weekly-report', name: '周报' }
] as const;

function getPmScene(jobId: string) {
  return `pm-assistant.${jobId}`;
}

function getPmTemplateName(jobName: string) {
  return `PM助手提示词-${jobName}`;
}

export default function CapabilitiesView({
  canWrite,
  selectedProjectId,
  selectedProjectName,
  onError,
  onMessage
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [name, setName] = useState(DEFAULT_TEMPLATE_NAME);
  const [description, setDescription] = useState('用于 AI 周报生成的模板配置');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [userPromptTemplate, setUserPromptTemplate] = useState(DEFAULT_USER_PROMPT_TEMPLATE);
  const [selectedPmJobId, setSelectedPmJobId] = useState<string>(PM_ASSISTANT_JOBS[0].id);
  const [pmSaving, setPmSaving] = useState(false);
  const [pmLoading, setPmLoading] = useState(false);
  const [pmEnabled, setPmEnabled] = useState(true);
  const [pmName, setPmName] = useState(getPmTemplateName(PM_ASSISTANT_JOBS[0].name));
  const [pmDescription, setPmDescription] = useState(`PM 助手「${PM_ASSISTANT_JOBS[0].name}」提示词模板`);
  const [pmSystemPrompt, setPmSystemPrompt] = useState('');
  const scopeLabel = useMemo(
    () => (selectedProjectId ? `项目级模板：${selectedProjectName}` : '组织级默认模板'),
    [selectedProjectId, selectedProjectName]
  );
  const selectedPmJob = useMemo(
    () => PM_ASSISTANT_JOBS.find((job) => job.id === selectedPmJobId) ?? PM_ASSISTANT_JOBS[0],
    [selectedPmJobId]
  );

  async function loadTemplate() {
    setLoading(true);
    try {
      const templates = await listCapabilityTemplates({
        scene: WEEKLY_REPORT_SCENE,
        projectId: selectedProjectId
      });
      const current = templates[0];
      setEnabled(current?.enabled ?? true);
      setName(current?.name ?? DEFAULT_TEMPLATE_NAME);
      setDescription(current?.description ?? '用于 AI 周报生成的模板配置');
      setSystemPrompt(current?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);
      setUserPromptTemplate(current?.userPromptTemplate ?? DEFAULT_USER_PROMPT_TEMPLATE);
    } catch (err) {
      onError(err instanceof Error ? err.message : '加载能力模板失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplate();
  }, [selectedProjectId]);

  async function loadPmTemplate() {
    setPmLoading(true);
    try {
      const templates = await listCapabilityTemplates({
        scene: getPmScene(selectedPmJob.id),
        projectId: selectedProjectId
      });
      const current = templates[0];
      setPmEnabled(current?.enabled ?? true);
      setPmName(current?.name ?? getPmTemplateName(selectedPmJob.name));
      setPmDescription(current?.description ?? `PM 助手「${selectedPmJob.name}」提示词模板`);
      setPmSystemPrompt(current?.systemPrompt ?? '');
    } catch (err) {
      onError(err instanceof Error ? err.message : '加载 PM 助手模板失败');
    } finally {
      setPmLoading(false);
    }
  }

  useEffect(() => {
    void loadPmTemplate();
  }, [selectedProjectId, selectedPmJobId]);

  async function handleSave() {
    if (!canWrite) return;
    setSaving(true);
    try {
      await saveCapabilityTemplate({
        scene: WEEKLY_REPORT_SCENE,
        name,
        description,
        systemPrompt,
        userPromptTemplate,
        projectId: selectedProjectId,
        enabled
      });
      onMessage(`已保存${scopeLabel}`);
      await loadTemplate();
    } catch (err) {
      onError(err instanceof Error ? err.message : '保存能力模板失败');
    } finally {
      setSaving(false);
    }
  }

  async function handlePmSave() {
    if (!canWrite) return;
    setPmSaving(true);
    try {
      await saveCapabilityTemplate({
        scene: getPmScene(selectedPmJob.id),
        name: pmName || getPmTemplateName(selectedPmJob.name),
        description: pmDescription,
        systemPrompt: pmSystemPrompt,
        projectId: selectedProjectId,
        enabled: pmEnabled
      });
      onMessage(`已保存 PM 助手模板：${selectedPmJob.name}`);
      await loadPmTemplate();
    } catch (err) {
      onError(err instanceof Error ? err.message : '保存 PM 助手模板失败');
    } finally {
      setPmSaving(false);
    }
  }

  return (
    <div className="capabilities-page">
      <div className="card">
        <div className="section-title-row">
          <h3>能力模板</h3>
          <span className="muted">当前只开放 AI 周报模板，可按项目覆盖组织默认配置</span>
        </div>
        <div className="muted">{scopeLabel}</div>
      </div>

      <div className="card capabilities-card-gap">
        <div className="section-title-row">
          <h3>AI 周报模板</h3>
          <div className="panel-actions">
            <label className="muted capabilities-enabled-row">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={!canWrite} />
              启用模板
            </label>
            <button className="btn btn-primary" type="button" onClick={() => void handleSave()} disabled={!canWrite || saving}>
              {saving ? '保存中...' : '保存模板'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="muted">正在加载模板...</div>
        ) : (
          <div className="capabilities-form">
            <div className="capabilities-field">
              <label>模板名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canWrite} />
            </div>
            <div className="capabilities-field">
              <label>说明</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canWrite} />
            </div>
            <div className="capabilities-field">
              <label>系统提示词</label>
              <textarea rows={8} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} disabled={!canWrite} />
            </div>
            <div className="capabilities-field">
              <label>用户提示词模板</label>
              <textarea rows={12} value={userPromptTemplate} onChange={(e) => setUserPromptTemplate(e.target.value)} disabled={!canWrite} />
            </div>
            <div className="muted">
              可用变量：{'{{projectNames}}'}、{'{{weekStart}}'}、{'{{weekEnd}}'}、{'{{includeRisks}}'}、{'{{healthTable}}'}、{'{{testQualityTable}}'}、{'{{detailBlocks}}'}、{'{{draft}}'}
            </div>
          </div>
        )}
      </div>

      <div className="card capabilities-card-gap">
        <div className="section-title-row">
          <h3>PM 助手模板</h3>
          <div className="panel-actions">
            <label className="muted capabilities-enabled-row">
              <input type="checkbox" checked={pmEnabled} onChange={(e) => setPmEnabled(e.target.checked)} disabled={!canWrite} />
              启用模板
            </label>
            <button className="btn btn-primary" type="button" onClick={() => void handlePmSave()} disabled={!canWrite || pmSaving}>
              {pmSaving ? '保存中...' : '保存模板'}
            </button>
          </div>
        </div>

        {pmLoading ? (
          <div className="muted">正在加载 PM 助手模板...</div>
        ) : (
          <div className="capabilities-form">
            <div className="capabilities-field">
              <label>任务类型</label>
              <select value={selectedPmJobId} onChange={(e) => setSelectedPmJobId(e.target.value)} disabled={!canWrite}>
                {PM_ASSISTANT_JOBS.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="capabilities-field">
              <label>模板名称</label>
              <input value={pmName} onChange={(e) => setPmName(e.target.value)} disabled={!canWrite} />
            </div>
            <div className="capabilities-field">
              <label>说明</label>
              <input value={pmDescription} onChange={(e) => setPmDescription(e.target.value)} disabled={!canWrite} />
            </div>
            <div className="capabilities-field">
              <label>系统提示词</label>
              <textarea
                rows={10}
                value={pmSystemPrompt}
                onChange={(e) => setPmSystemPrompt(e.target.value)}
                disabled={!canWrite}
                placeholder="留空则回退到旧项目配置、环境变量或内置默认模板"
              />
            </div>
            <div className="muted">当前任务类型：{selectedPmJob.name}。这里只管理系统提示词，运行时仍会自动拼接项目上下文和原始要点。</div>
          </div>
        )}
      </div>
    </div>
  );
}
