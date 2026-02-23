import type { FormEvent, KeyboardEvent } from 'react';
import type { FeishuRecord } from '../api/feishu';
import type { FeishuFormState } from '../types';
import { FEISHU_FIELDS } from '../feishuConfig';
import TableToolbar from '../components/TableToolbar';
import PaginationBar from '../components/PaginationBar';

type Props = {
  canWrite: boolean;
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
  const visibleFields = FEISHU_FIELDS.filter((field) => visibleColumns.includes(field.key));
  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>飞书多维表格</h3>
        <div style={{ marginTop: 10 }}>
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>字段配置（只读）</summary>
            <table className="table" style={{ marginTop: 10 }}>
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
        <div style={{ marginTop: 10 }}>
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>列显示配置</summary>
            <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginTop: 8 }}>
              {FEISHU_FIELDS.map((field) => (
                <label key={String(field.key)} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(field.key)}
                    onChange={(e) => onToggleColumn(field.key, e.target.checked)}
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
        {canWrite && (
          <form className="form" onSubmit={onSubmitFeishu} style={{ marginTop: 8 }}>
            {FEISHU_FIELDS.map((field) => {
              const value = feishuForm[field.key] ?? '';
              const options = field.key === '所属项目'
                ? feishuProjectOptions
                : field.key === '负责人'
                  ? feishuUserOptions
                  : field.options ?? [];
              if (field.type === 'select') {
                return (
                  <select
                    key={String(field.key)}
                    value={value}
                    onChange={(e) => onUpdateFeishuField(field.key, e.target.value)}
                    required={field.required}
                  >
                    {!value && <option value="">请选择{field.label}</option>}
                    {options.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
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
        )}
        {!canWrite && <p className="warn">当前角色为只读（viewer），新增与修改操作已禁用。</p>}
        {feishuMessage && <p>{feishuMessage}</p>}
        {feishuError && <p className="warn">{feishuError}</p>}
      </div>

      <div className="card">
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
          <select value={feishuFilterProject} onChange={(e) => onSetFeishuFilterProject(e.target.value)}>
            <option value="">所属项目(全部)</option>
            {feishuProjectOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select value={feishuFilterStatus} onChange={(e) => onSetFeishuFilterStatus(e.target.value)}>
            <option value="">状态(全部)</option>
            {['待办', '进行中', '已完成'].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <input
            placeholder="负责人(包含匹配)"
            value={feishuFilterAssignee}
            onChange={(e) => onSetFeishuFilterAssignee(e.target.value)}
          />
          <select value={feishuFilterRisk} onChange={(e) => onSetFeishuFilterRisk(e.target.value)}>
            <option value="">风险等级(全部)</option>
            {['低', '中', '高'].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select value={feishuPageSize} onChange={(e) => onSetFeishuPageSize(Number(e.target.value))}>
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>每页 {size}</option>
            ))}
          </select>
          <button className="btn" type="button" onClick={onLoadFeishu}>查询/刷新</button>
          <button className="btn" type="button" onClick={onExportFeishu}>导出CSV</button>
          <label className="btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
            导入CSV
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportFeishu(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
          {canWrite && (
            <button className="btn" type="button" disabled={selectedFeishuIds.length === 0} onClick={onDeleteSelectedFeishu}>
              批量删除 ({selectedFeishuIds.length})
            </button>
          )}
        </TableToolbar>

        {feishuLoading && <p>Loading...</p>}
        <table className="table table-wrap">
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
                <th key={String(field.key)}>{field.label}</th>
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
                          <td key={String(field.key)} className="editing">
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
                        <td key={String(field.key)} className="editing">
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
                        onDoubleClick={() => canWrite && onStartInlineEdit(record, field.key)}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                  {canWrite && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      {isEditing && isDirty ? (
                        <>
                          <button className="btn" type="button" disabled={!isDirty} onClick={() => onSaveInlineEdit(record)}>保存</button>
                          <button className="btn" type="button" onClick={onCancelInlineEdit}>取消</button>
                        </>
                      ) : (
                        <button className="btn" type="button" onClick={() => onRemoveFeishu(record)}>删除</button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

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
