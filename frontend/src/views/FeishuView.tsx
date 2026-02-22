import type { FormEvent, KeyboardEvent } from 'react';
import type { FeishuRecord } from '../api/feishu';
import type { FeishuFormState, ProjectItem } from '../types';
import { FEISHU_FIELDS } from '../feishuConfig';

type Props = {
  canWrite: boolean;
  projects: ProjectItem[];
  feishuForm: FeishuFormState;
  feishuMessage: string;
  feishuError: string;
  feishuLoading: boolean;
  feishuRecords: FeishuRecord[];
  filteredFeishuRecords: FeishuRecord[];
  feishuProjectOptions: string[];
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
  onPrevPage: () => void;
  onNextPage: () => void;
  onRemoveFeishu: (record: FeishuRecord) => void;
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
  projects,
  feishuForm,
  feishuMessage,
  feishuError,
  feishuLoading,
  feishuRecords,
  filteredFeishuRecords,
  feishuProjectOptions,
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
  onPrevPage,
  onNextPage,
  onRemoveFeishu,
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
  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>飞书多维表格</h3>
        {canWrite && (
          <form className="form" onSubmit={onSubmitFeishu} style={{ marginTop: 8 }}>
            {FEISHU_FIELDS.map((field) => {
              const value = feishuForm[field.key] ?? '';
              const options = field.key === '所属项目'
                ? feishuProjectOptions
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
        <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 8 }}>
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
        </div>

        {feishuLoading && <p>Loading...</p>}
        <table className="table table-wrap">
          <thead>
            <tr>
              {FEISHU_FIELDS.map((field) => (
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
                  {FEISHU_FIELDS.map((field) => {
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

        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <button className="btn" type="button" onClick={onPrevPage} disabled={feishuPageStack.length === 0}>上一页</button>
          <button className="btn" type="button" onClick={onNextPage} disabled={!feishuHasMore}>下一页</button>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            记录数: {filteredFeishuRecords.length} / {feishuRecords.length}
          </span>
        </div>
      </div>
    </div>
  );
}
