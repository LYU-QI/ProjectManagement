import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { FeishuRecord } from '../api/feishu';
import type { FeishuFormState } from '../types';
import { FEISHU_FIELDS } from '../feishuConfig';
import TableToolbar from '../components/TableToolbar';
import PaginationBar from '../components/PaginationBar';
import usePersistentBoolean from '../hooks/usePersistentBoolean';
import ThemedSelect from '../components/ui/ThemedSelect';
import AutocompleteOwner from '../components/ui/AutocompleteOwner';
import ScopeContextBar from '../components/ScopeContextBar';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import AsyncStatePanel from '../components/AsyncStatePanel';

type Props = {
  canWrite: boolean;
  activeOrgName?: string | null;
  selectedProjectName: string;
  selectedProjectId: number | null;
  feishuForm: FeishuFormState;
  feishuMessage: string;
  feishuError: string;
  feishuLoading: boolean;
  feishuRecords: FeishuRecord[];
  filteredFeishuRecords: FeishuRecord[];
  feishuProjectOptions: string[];
  feishuUserOptions: string[];
  selectedFeishuIds: string[];
  visibleColumns: Array<keyof FeishuFormState>;
  feishuSearch: string;
  feishuSearchFields: string;
  feishuFilterProject: string;
  feishuFilterStatus: string;
  feishuFilterAssignee: string;
  feishuFilterRisk: string;
  feishuPageSize: number;
  feishuHasMore: boolean;
  feishuPageStack: string[];
  onUpdateFeishuField: (key: keyof FeishuFormState, value: string) => void;
  onSubmitFeishu: (e: FormEvent<HTMLFormElement>) => void;
  onSetFeishuSearch: (value: string) => void;
  onSetFeishuSearchFields: (value: string) => void;
  onSetFeishuFilterProject: (value: string) => void;
  onSetFeishuFilterStatus: (value: string) => void;
  onSetFeishuFilterAssignee: (value: string) => void;
  onSetFeishuFilterRisk: (value: string) => void;
  onSetFeishuPageSize: (value: number) => void;
  onLoadFeishu: () => void;
  onExportFeishu: () => void;
  onImportFeishu: (file: File) => void;
  onToggleColumn: (key: keyof FeishuFormState, checked: boolean) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRemoveFeishu: (record: FeishuRecord) => void;
  onDeleteSelectedFeishu: () => void;
  onToggleFeishuSelection: (id: string, checked: boolean) => void;
  onSelectAllFeishu: (ids: string[], checked: boolean) => void;
  onStartInlineEdit: (record: FeishuRecord, field?: keyof FeishuFormState) => void;
  onUpdateRecordDraft: (field: keyof FeishuFormState, value: string) => void;
  onFinalizeInlineEdit: (record: FeishuRecord) => void;
  onSaveInlineEdit: (record: FeishuRecord) => void;
  onCancelInlineEdit: () => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, onSave: () => void, onCancel: () => void) => void;
  feishuEditingId: string | null;
  feishuEditingField: keyof FeishuFormState | null;
  feishuRecordDraft: FeishuFormState | null;
  onHasDraftChanges: (original: FeishuFormState, draft: FeishuFormState | null) => boolean;
  onMapRecordToForm: (record: FeishuRecord) => FeishuFormState;
  formatFeishuValue: (value: unknown) => string;
  formatDateValue: (value: unknown) => string | null;
  formatProgressValue: (value: unknown) => string;
  getAssigneeName: (value: unknown) => string;
};

export default function FeishuView({
  canWrite,
  activeOrgName,
  selectedProjectName,
  selectedProjectId,
  feishuForm,
  feishuMessage,
  feishuError,
  feishuLoading,
  feishuRecords,
  filteredFeishuRecords,
  feishuProjectOptions,
  feishuUserOptions,
  selectedFeishuIds,
  visibleColumns,
  feishuSearch,
  feishuSearchFields,
  feishuFilterProject,
  feishuFilterStatus,
  feishuFilterAssignee,
  feishuFilterRisk,
  feishuPageSize,
  feishuHasMore,
  feishuPageStack,
  onUpdateFeishuField,
  onSubmitFeishu,
  onSetFeishuSearch,
  onSetFeishuSearchFields,
  onSetFeishuFilterProject,
  onSetFeishuFilterStatus,
  onSetFeishuFilterAssignee,
  onSetFeishuFilterRisk,
  onSetFeishuPageSize,
  onLoadFeishu,
  onExportFeishu,
  onImportFeishu,
  onToggleColumn,
  onPrevPage,
  onNextPage,
  onRemoveFeishu,
  onDeleteSelectedFeishu,
  onToggleFeishuSelection,
  onSelectAllFeishu,
  onStartInlineEdit,
  onUpdateRecordDraft,
  onFinalizeInlineEdit,
  onSaveInlineEdit,
  onCancelInlineEdit,
  onInlineKeyDown,
  feishuEditingId,
  feishuEditingField,
  feishuRecordDraft,
  onHasDraftChanges,
  onMapRecordToForm,
  formatFeishuValue,
  formatDateValue,
  formatProgressValue,
  getAssigneeName
}: Props) {
  const recoveryContext = useWorkspaceStore((state) => state.recoveryContext);
  const clearRecoveryContext = useWorkspaceStore((state) => state.clearRecoveryContext);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const recoveryHandledRef = useRef<string | null>(null);
  const [pageRecoveryContext, setPageRecoveryContext] = useState<typeof recoveryContext>(null);
  const columnHintMap: Partial<Record<keyof FeishuFormState, string>> = {
    任务ID: '唯一任务标识',
    任务名称: '任务标题展示',
    状态: '任务状态筛选',
    优先级: '优先级分层',
    负责人: '责任人展示',
    开始时间: '计划开始时间',
    截止时间: '计划截止时间',
    进度: '进度百分比',
    所属项目: '项目归属',
    是否阻塞: '阻塞状态',
    阻塞原因: '阻塞说明',
    风险等级: '风险分级',
    里程碑: '关键节点标识'
  };

  const toggleAllColumns = (checked: boolean) => {
    if (checked) {
      FEISHU_FIELDS.forEach((field) => onToggleColumn(field.key, true));
      return;
    }
    FEISHU_FIELDS.forEach((field) => onToggleColumn(field.key, false));
    onToggleColumn('任务名称', true);
  };

  const fieldCellClassMap: Partial<Record<keyof FeishuFormState, string>> = {
    任务名称: 'feishu-col-task-name',
    所属项目: 'feishu-col-project',
    阻塞原因: 'feishu-col-block-reason',
    任务ID: 'feishu-col-id',
    负责人: 'feishu-col-assignee'
  };
  const [filtersOpen, setFiltersOpen] = usePersistentBoolean('ui:feishu:filtersOpen', true);
  const [compactTable, setCompactTable] = usePersistentBoolean('ui:feishu:compactTable', false);
  const [submitFormOpen, setSubmitFormOpen] = usePersistentBoolean('ui:feishu:submitFormOpen', true);
  const visibleFields = FEISHU_FIELDS.filter((field) => visibleColumns.includes(field.key));
  const usingProjectScopedTable = selectedProjectId != null;
  const showIncomingRecovery = recoveryContext?.from === 'task-center' && recoveryContext.source === 'feishu';
  const showRecoveryBanner = pageRecoveryContext?.from === 'task-center' && pageRecoveryContext.source === 'feishu';

  useEffect(() => {
    if (!showIncomingRecovery) return;
    const recoveryKey = [
      recoveryContext.source,
      recoveryContext.errorCode || '',
      recoveryContext.projectName || '',
      usingProjectScopedTable ? 'project-scoped' : 'org-scoped'
    ].join(':');
    if (recoveryHandledRef.current === recoveryKey) return;
    recoveryHandledRef.current = recoveryKey;
    setPageRecoveryContext(recoveryContext);
    if (!usingProjectScopedTable && recoveryContext.projectName) {
      onSetFeishuFilterProject(recoveryContext.projectName);
    }
    onLoadFeishu();
    clearRecoveryContext();
  }, [showIncomingRecovery, usingProjectScopedTable, recoveryContext, onLoadFeishu, onSetFeishuFilterProject, clearRecoveryContext]);

  return (
    <div>
      <ScopeContextBar
        moduleLabel="飞书集成作用域"
        orgName={activeOrgName}
        projectName={selectedProjectName}
        projectId={selectedProjectId}
        scopeLabel={usingProjectScopedTable ? '项目级作用域' : '组织级作用域'}
        sourceLabel={usingProjectScopedTable ? '项目绑定飞书多维表' : '全局飞书多维表'}
        note={usingProjectScopedTable ? '当前列表已经按项目绑定的数据表读取，页面内不再把“所属项目”作为切表逻辑。' : '当前读取的是组织级全局飞书表，页面筛选只影响列表，不改变数据源。'}
      />
      {showRecoveryBanner && (
        <div className="task-center-recovery-banner">
          <div>
            <strong>来自任务中心的恢复上下文</strong>
            <div className="muted">
              当前建议优先检查飞书集成问题
              {pageRecoveryContext?.errorCode ? `（${pageRecoveryContext.errorCode}）` : ''}
              {pageRecoveryContext?.projectName ? `，项目：${pageRecoveryContext.projectName}` : ''}。
            </div>
          </div>
          <button type="button" className="btn" onClick={() => setPageRecoveryContext(null)}>
            关闭提示
          </button>
        </div>
      )}
      <div className="card feishu-config-card">
        <h3>飞书多维表格</h3>
        <p className="muted">
          当前读取数据源：
          {usingProjectScopedTable ? ` 项目「${selectedProjectName}」绑定的飞书多维表` : ' 全局飞书多维表'}
        </p>
        {usingProjectScopedTable && (
          <p className="muted">
            当前已按项目绑定表读取数据，下面的列表不再显示“所属项目”筛选，避免和全局项目选择重复。
          </p>
        )}
        <div className="feishu-config-block">
          <details>
            <summary className="feishu-summary">字段配置（只读）</summary>
            <table className="table feishu-config-table">
              <thead>
                <tr>
                  <th>字段</th>
                  <th>类型</th>
                  <th>选项</th>
                </tr>
              </thead>
              <tbody>
                {FEISHU_FIELDS.map((field) => {
                  const options = field.key === '所属项目'
                    ? feishuProjectOptions
                    : field.key === '负责人'
                      ? feishuUserOptions
                      : field.options ?? [];
                  return (
                    <tr key={String(field.key)}>
                      <td>{field.label}</td>
                      <td>{field.type}</td>
                      <td>{options.length > 0 ? options.join('、') : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </div>
        <div className="feishu-config-block">
          <details>
            <summary className="feishu-summary">列显示配置</summary>
            <div className="feishu-columns-panel">
              <div className="feishu-columns-head">
                <h4 className="feishu-columns-title">列开关</h4>
                <div className="feishu-columns-actions">
                  <button className="btn" type="button" onClick={() => toggleAllColumns(true)}>全选显示</button>
                  <button className="btn" type="button" onClick={() => toggleAllColumns(false)}>全选隐藏</button>
                </div>
              </div>
              <div className="feishu-columns-grid">
                {FEISHU_FIELDS.map((field) => (
                  <label key={String(field.key)} className="feishu-column-item">
                    <div className="feishu-column-item-main">
                      <span className="feishu-column-item-title">{field.label}</span>
                      <span className="feishu-column-item-subtitle">{columnHintMap[field.key] || '列显示开关'}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(field.key)}
                      onChange={(e) => onToggleColumn(field.key, e.target.checked)}
                    />
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>
        {canWrite && (
          <div className="feishu-config-block">
            <details
              open={submitFormOpen}
              onToggle={(e) => setSubmitFormOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="feishu-summary">提交记录</summary>
              <form className="form feishu-submit-form" onSubmit={onSubmitFeishu}>
                {FEISHU_FIELDS.map((field) => {
                  const value = feishuForm[field.key] ?? '';
                  const options = field.key === '所属项目'
                    ? feishuProjectOptions
                    : field.key === '负责人'
                      ? feishuUserOptions
                      : field.options ?? [];
                  if (field.key === '负责人') {
                    return (
                      <AutocompleteOwner
                        key={String(field.key)}
                        value={value}
                        onChange={(v) => onUpdateFeishuField(field.key, v)}
                        options={feishuUserOptions}
                        placeholder="输入或选择负责人"
                      />
                    );
                  }
                  if (field.type === 'select') {
                    return (
                      <ThemedSelect
                        key={String(field.key)}
                        value={value}
                        onChange={(e) => onUpdateFeishuField(field.key, e.target.value)}
                        required={field.required}
                      >
                        {!value && <option value="">请选择{field.label}</option>}
                        {options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </ThemedSelect>
                    );
                  }
                  return (
                    <input
                      key={String(field.key)}
                      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                      value={value}
                      placeholder={field.label}
                      required={field.required}
                      onChange={(e) => onUpdateFeishuField(field.key, e.target.value)}
                    />
                  );
                })}
                <button className="btn" type="submit">提交记录</button>
              </form>
            </details>
          </div>
        )}
        {!canWrite && <p className="warn">当前角色为只读（访客），新增与修改操作已禁用。</p>}
        {feishuMessage && <p>{feishuMessage}</p>}
        {feishuError && <p className="warn">{feishuError}</p>}
      </div>

      <div className="card">
        <div className="section-title-row">
          <h3>飞书记录列表</h3>
          <div className="panel-actions">
            <span className="muted">当前 {filteredFeishuRecords.length} / {feishuRecords.length}</span>
            <button className="btn" type="button" onClick={() => setCompactTable((prev) => !prev)}>
              {compactTable ? '标准密度' : '紧凑密度'}
            </button>
            <button className="btn" type="button" onClick={() => setFiltersOpen((prev) => !prev)}>
              {filtersOpen ? '收起筛选' : '展开筛选'}
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="filter-panel">
            <TableToolbar>
              <input
                placeholder="搜索关键词"
                value={feishuSearch}
                onChange={(e) => onSetFeishuSearch(e.target.value)}
              />
              <input
                placeholder="搜索字段(逗号分隔)"
                value={feishuSearchFields}
                onChange={(e) => onSetFeishuSearchFields(e.target.value)}
              />
              {!usingProjectScopedTable && (
                <ThemedSelect value={feishuFilterProject} onChange={(e) => onSetFeishuFilterProject(e.target.value)}>
                  <option value="">所属项目(全部)</option>
                  {feishuProjectOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </ThemedSelect>
              )}
              <ThemedSelect value={feishuFilterStatus} onChange={(e) => onSetFeishuFilterStatus(e.target.value)}>
                <option value="">状态(全部)</option>
                {['待办', '进行中', '已完成'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </ThemedSelect>
              <input
                placeholder="负责人(包含匹配)"
                value={feishuFilterAssignee}
                onChange={(e) => onSetFeishuFilterAssignee(e.target.value)}
              />
              <ThemedSelect value={feishuFilterRisk} onChange={(e) => onSetFeishuFilterRisk(e.target.value)}>
                <option value="">风险等级(全部)</option>
                {['低', '中', '高'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </ThemedSelect>
              <ThemedSelect value={String(feishuPageSize)} onChange={(e) => onSetFeishuPageSize(Number(e.target.value))}>
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>每页 {size}</option>
                ))}
              </ThemedSelect>
              <button className="btn" type="button" onClick={onLoadFeishu}>查询/刷新</button>
              <button className="btn" type="button" onClick={onExportFeishu}>导出CSV</button>
              <button className="btn feishu-import-btn" type="button" onClick={() => importInputRef.current?.click()}>
                导入CSV
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv"
                className="feishu-import-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportFeishu(file);
                  e.currentTarget.value = '';
                }}
              />
              {canWrite && (
                <button className="btn" type="button" disabled={selectedFeishuIds.length === 0} onClick={onDeleteSelectedFeishu}>
                  批量删除 ({selectedFeishuIds.length})
                </button>
              )}
            </TableToolbar>
          </div>
        )}

        {feishuLoading && (
          <AsyncStatePanel
            tone="loading"
            title="正在加载飞书记录"
            description="正在读取当前作用域下的多维表格记录与筛选结果。"
          />
        )}
        {!feishuLoading && filteredFeishuRecords.length === 0 && (
          <AsyncStatePanel
            tone={feishuError ? 'error' : 'empty'}
            title={feishuError ? '飞书记录加载异常' : '当前范围暂无飞书记录'}
            description={feishuError
              ? '请先检查飞书权限、项目绑定表配置或后端服务状态，然后重新刷新。'
              : '可以放宽筛选条件、切换项目，或先提交一条记录再查看列表。'}
            action={(
              <button className="btn" type="button" onClick={onLoadFeishu}>
                重新刷新
              </button>
            )}
          />
        )}
        {filteredFeishuRecords.length > 0 && (
        <div className="table-wrap">
          <table className={`table feishu-records-table ${visibleFields.length <= 2 ? 'feishu-records-table--narrow' : ''} ${compactTable ? 'table-compact' : ''}`}>
            <thead>
              <tr>
                {canWrite && (
                  <th>
                    <input
                      type="checkbox"
                      checked={filteredFeishuRecords.length > 0 && selectedFeishuIds.length === filteredFeishuRecords.length}
                      onChange={(e) => onSelectAllFeishu(filteredFeishuRecords.map((r) => r.record_id), e.target.checked)}
                    />
                  </th>
                )}
                {visibleFields.map((field) => (
                  <th key={String(field.key)} className={fieldCellClassMap[field.key] || ''}>{field.label}</th>
                ))}
                {canWrite && <th>操作</th>}
              </tr>
            </thead>
            <tbody>
              {filteredFeishuRecords.map((record) => {
              const fields = (record.fields || {}) as Record<string, unknown>;
              const originalForm = onMapRecordToForm(record);
              const isEditing = feishuEditingId === record.record_id;
              const rowDraft = isEditing ? (feishuRecordDraft ?? originalForm) : originalForm;
              const isDirty = isEditing && onHasDraftChanges(originalForm, feishuRecordDraft);

              return (
                <tr key={record.record_id} className={isEditing ? 'editing-row' : ''}>
                  {canWrite && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedFeishuIds.includes(record.record_id)}
                        onChange={(e) => onToggleFeishuSelection(record.record_id, e.target.checked)}
                      />
                    </td>
                  )}
                  {visibleFields.map((field) => {
                    const cellValue = rowDraft[field.key];
                    const isCellEditing = isEditing && feishuEditingField === field.key;
                    const displayValue = (() => {
                      const value = isEditing ? rowDraft[field.key] : fields[field.key];
                      if (field.key === '负责人') {
                        const name = isEditing ? String(value ?? '') : getAssigneeName(fields['负责人']);
                        return name || '-';
                      }
                      if (field.key === '开始时间' || field.key === '截止时间') {
                        return formatDateValue(value) || '-';
                      }
                      if (field.key === '进度') {
                        return formatProgressValue(value);
                      }
                      return formatFeishuValue(value);
                    })();

                    if (isCellEditing) {
                      const options = field.key === '所属项目'
                        ? feishuProjectOptions
                        : field.key === '负责人'
                          ? feishuUserOptions
                          : field.options ?? [];
                      if (field.type === 'select') {
                        return (
                          <td key={String(field.key)} className={`${fieldCellClassMap[field.key] || ''} editing`.trim()}>
                            <select
                              data-feishu-edit={`${record.record_id}-${String(field.key)}`}
                              value={cellValue ?? ''}
                              onChange={(e) => onUpdateRecordDraft(field.key, e.target.value)}
                              onKeyDown={(e) => onInlineKeyDown(e, () => onSaveInlineEdit(record), onCancelInlineEdit)}
                              onBlur={() => onFinalizeInlineEdit(record)}
                            >
                              {options.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </td>
                        );
                      }
                      return (
                        <td key={String(field.key)} className={`${fieldCellClassMap[field.key] || ''} editing`.trim()}>
                          <input
                            data-feishu-edit={`${record.record_id}-${String(field.key)}`}
                            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                            value={cellValue ?? ''}
                            onChange={(e) => onUpdateRecordDraft(field.key, e.target.value)}
                            onKeyDown={(e) => onInlineKeyDown(e, () => onSaveInlineEdit(record), onCancelInlineEdit)}
                            onBlur={() => onFinalizeInlineEdit(record)}
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={String(field.key)}
                        className={fieldCellClassMap[field.key] || ''}
                        onDoubleClick={() => canWrite && onStartInlineEdit(record, field.key)}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                  {canWrite && (
                    <td className="feishu-row-actions">
                      {isEditing && isDirty ? (
                        <div className="table-row-actions table-row-actions--stack">
                          <button className="btn" type="button" disabled={!isDirty} onClick={() => onSaveInlineEdit(record)}>保存</button>
                          <button className="btn" type="button" onClick={onCancelInlineEdit}>取消</button>
                        </div>
                      ) : (
                        <div className="table-row-actions">
                          <button className="btn btn-ghost-danger" type="button" onClick={() => onRemoveFeishu(record)}>删除</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
        )}

        <PaginationBar
          onPrev={onPrevPage}
          onNext={onNextPage}
          hasPrev={feishuPageStack.length > 0}
          hasNext={feishuHasMore}
          summary={`记录数: ${filteredFeishuRecords.length} / ${feishuRecords.length}`}
        />
      </div>
    </div>
  );
}
