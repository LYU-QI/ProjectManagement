import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createResourceMaintenance,
  DepartmentSyncPreview,
  fillSystemDepartmentsFromFeishu,
  getResourceMaintenanceOptions,
  listResourceMaintenance,
  previewDepartmentSync,
  ResourceMaintenanceKind,
  ResourceMaintenanceOptions,
  ResourceMaintenanceRow,
  syncSystemDepartmentsToFeishu,
  updateResourceMaintenance
} from '../api/resourceMaintenance';
import AsyncStatePanel from '../components/AsyncStatePanel';

type Tab = ResourceMaintenanceKind;

type FormState = {
  recordId: string;
  personId: string;
  name: string;
  role: string;
  department: string;
  level: string;
  location: string;
  dailyCapacity: string;
  status: string;
  remark: string;
  allocationId: string;
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
  allocationPercent: string;
  allocationDays: string;
  allocationType: string;
  availabilityId: string;
  date: string;
  availablePercent: string;
  availabilityType: string;
  reason: string;
};

const emptyForm: FormState = {
  recordId: '',
  personId: '',
  name: '',
  role: '',
  department: '',
  level: '',
  location: '',
  dailyCapacity: '1',
  status: '在岗',
  remark: '',
  allocationId: '',
  projectId: '',
  projectName: '',
  startDate: '',
  endDate: '',
  allocationPercent: '',
  allocationDays: '',
  allocationType: '',
  availabilityId: '',
  date: '',
  availablePercent: '50',
  availabilityType: '请假',
  reason: ''
};

const emptyOptions: ResourceMaintenanceOptions = {
  generatedAt: '',
  people: [],
  projects: [],
  departments: [],
  roles: [],
  levels: [],
  locations: [],
  statuses: ['在岗', '停用', '离职'],
  systemDepartments: [],
  allocationTypes: ['项目投入', '售前支持', '研发支持', '测试支持'],
  availabilityTypes: ['请假', '出差', '培训', '节假日', '临时占用']
};

function field(row: ResourceMaintenanceRow, key: string): string {
  const value = row.fields?.[key];
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (key.includes('日期') || key.includes('时间')) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
    return String(value);
  }
  return String(value);
}

function rowToForm(row: ResourceMaintenanceRow, tab: Tab): FormState {
  const base = { ...emptyForm, recordId: row.recordId };
  if (tab === 'people') {
    return {
      ...base,
      personId: field(row, '人员ID'),
      name: field(row, '姓名'),
      role: field(row, '角色'),
      department: field(row, '部门'),
      level: field(row, '职级'),
      location: field(row, '地点'),
      dailyCapacity: field(row, '日标准产能') || '1',
      status: field(row, '状态') || '在岗',
      remark: field(row, '备注')
    };
  }
  if (tab === 'allocations') {
    return {
      ...base,
      allocationId: field(row, '分配ID'),
      personId: field(row, '人员ID'),
      name: field(row, '姓名'),
      projectId: field(row, '项目ID'),
      projectName: field(row, '项目名称'),
      role: field(row, '角色'),
      startDate: field(row, '开始日期'),
      endDate: field(row, '结束时间'),
      allocationPercent: field(row, '投入比例') || '50',
      allocationDays: field(row, '投入人天'),
      allocationType: field(row, '分配类型'),
      remark: field(row, '备注')
    };
  }
  return {
    ...base,
    availabilityId: field(row, '记录ID'),
    personId: field(row, '人员ID'),
    name: field(row, '姓名'),
    date: field(row, '日期'),
    availablePercent: field(row, '可用比例') || '50',
    availabilityType: field(row, '不可用类型') || '请假',
    reason: field(row, '原因'),
    remark: field(row, '备注')
  };
}

function tabTitle(tab: Tab) {
  if (tab === 'people') return '人员资源';
  if (tab === 'allocations') return '资源分配';
  return '人员日历例外';
}

const tableColumns: Record<Tab, string[]> = {
  people: ['人员ID', '姓名', '角色', '部门', '部门同步', '职级', '地点', '日标准产能', '状态', '备注'],
  allocations: ['分配ID', '人员ID', '姓名', '项目ID', '项目名称', '角色', '开始日期', '结束时间', '投入比例', '投入人天', '分配类型', '备注'],
  availability: ['记录ID', '人员ID', '姓名', '日期', '可用比例', '不可用类型', '原因', '备注']
};

function inclusiveDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const startTime = new Date(`${start}T00:00:00+08:00`).getTime();
  const endTime = new Date(`${end}T00:00:00+08:00`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return 0;
  return Math.floor((endTime - startTime) / 86400000) + 1;
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function calculateAllocationPercent(allocationDays: string, startDate: string, endDate: string, dailyCapacity: string): string {
  const days = inclusiveDays(startDate, endDate);
  const workDays = Number(allocationDays);
  const capacity = Number(dailyCapacity || 1);
  if (!days || !Number.isFinite(workDays) || workDays <= 0 || !Number.isFinite(capacity) || capacity <= 0) return '';
  return formatPercent((workDays / (days * capacity)) * 100);
}

export default function ResourceMaintenanceView() {
  const [tab, setTab] = useState<Tab>('people');
  const [rows, setRows] = useState<ResourceMaintenanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [options, setOptions] = useState<ResourceMaintenanceOptions>(emptyOptions);
  const [keyword, setKeyword] = useState('');
  const [departmentSync, setDepartmentSync] = useState<DepartmentSyncPreview | null>(null);
  const [syncingDepartments, setSyncingDepartments] = useState(false);

  async function load(nextTab = tab) {
    setLoading(true);
    setError('');
    try {
      const data = await listResourceMaintenance(nextTab);
      setRows(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '资源维护数据加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions() {
    try {
      const data = await getResourceMaintenanceOptions();
      setOptions({ ...emptyOptions, ...data });
    } catch {
      setOptions(emptyOptions);
    }
  }

  async function loadDepartmentSyncPreview() {
    try {
      setDepartmentSync(await previewDepartmentSync());
    } catch {
      setDepartmentSync(null);
    }
  }

  useEffect(() => {
    setForm(emptyForm);
    setKeyword('');
    void load(tab);
    if (tab === 'people') void loadDepartmentSyncPreview();
  }, [tab]);

  useEffect(() => {
    void loadOptions();
    void loadDepartmentSyncPreview();
  }, []);

  const visibleRows = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) => JSON.stringify(row.fields || {}).toLowerCase().includes(text));
  }, [keyword, rows]);

  const currentColumns = tableColumns[tab];
  const departmentSyncByRecordId = useMemo(() => {
    const map = new Map<string, DepartmentSyncPreview['items'][number]>();
    for (const item of departmentSync?.items ?? []) map.set(item.recordId, item);
    return map;
  }, [departmentSync]);
  const departmentOptions = useMemo(() => {
    return Array.from(new Set([...(options.systemDepartments || []), ...options.departments].filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [options.departments, options.systemDepartments]);
  const selectedProject = options.projects.find((item) => item.projectId === form.projectId);
  const selectedPerson = options.people.find((item) => item.personId === form.personId);
  const selectedProjectPeriod = selectedProject?.startDate && selectedProject?.endDate
    ? `${selectedProject.startDate} 至 ${selectedProject.endDate}`
    : '项目周期未配置';

  function withCalculatedAllocationPercent(next: FormState, dailyCapacity = selectedPerson?.dailyCapacity || '1'): FormState {
    if (tab !== 'allocations') return next;
    const calculated = calculateAllocationPercent(next.allocationDays, next.startDate, next.endDate, dailyCapacity);
    if (calculated) return { ...next, allocationPercent: calculated };
    return next.allocationDays.trim() ? next : { ...next, allocationPercent: '' };
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      return key === 'allocationDays' || key === 'startDate' || key === 'endDate' || key === 'personId'
        ? withCalculatedAllocationPercent(next)
        : next;
    });
  }

  function applyPerson(personId: string) {
    const person = options.people.find((item) => item.personId === personId);
    setForm((prev) => withCalculatedAllocationPercent(
      {
        ...prev,
        personId,
        name: person?.name || prev.name,
        role: person?.role || prev.role,
        department: person?.department || prev.department,
        dailyCapacity: person?.dailyCapacity || prev.dailyCapacity
      },
      person?.dailyCapacity || '1'
    ));
  }

  function applyProject(projectId: string) {
    const project = options.projects.find((item) => item.projectId === projectId);
    setForm((prev) => ({
      ...prev,
      projectId,
      projectName: project?.projectName || prev.projectName
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = { ...form };
      delete (payload as Partial<FormState>).recordId;
      if (form.recordId) {
        await updateResourceMaintenance(tab, form.recordId, payload);
      } else {
        await createResourceMaintenance(tab, payload);
      }
      setMessage('已同步飞书');
      setForm(emptyForm);
      await load(tab);
      await loadOptions();
      await loadDepartmentSyncPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步飞书失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncSystemDepartmentsToFeishu() {
    setSyncingDepartments(true);
    setError('');
    setMessage('');
    try {
      const result = await syncSystemDepartmentsToFeishu();
      setMessage(`已同步系统部门到飞书：更新 ${result.summary.updated || 0} 人，待同步 ${result.summary.pending} 人，未匹配 ${result.summary.unmatched} 人`);
      await load(tab);
      await loadOptions();
      await loadDepartmentSyncPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步系统部门到飞书失败');
    } finally {
      setSyncingDepartments(false);
    }
  }

  async function handleFillSystemDepartmentsFromFeishu() {
    setSyncingDepartments(true);
    setError('');
    setMessage('');
    try {
      const result = await fillSystemDepartmentsFromFeishu();
      setMessage(`已从飞书补齐系统空部门：更新 ${result.summary.updated} 人，新建部门 ${result.summary.createdDepartments} 个，失败 ${result.summary.failed} 行`);
      await load(tab);
      await loadOptions();
      await loadDepartmentSyncPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : '从飞书补齐系统部门失败');
    } finally {
      setSyncingDepartments(false);
    }
  }

  function syncStatusText(recordId: string) {
    const item = departmentSyncByRecordId.get(recordId);
    if (!item) return '-';
    if (item.status === 'matched') return '已一致';
    if (item.status === 'pending') return `待同步：${item.feishuDepartment || '未填'} → ${item.systemDepartment}`;
    if (item.status === 'system_unassigned') return '系统未分配';
    return '未匹配成员';
  }

  return (
    <section className="resource-maintenance">
      <div className="page-toolbar-row">
        <button className="btn" type="button" onClick={() => void load(tab)} disabled={loading}>刷新</button>
        <button className="btn" type="button" onClick={() => void loadDepartmentSyncPreview()} disabled={loading || syncingDepartments}>刷新部门同步状态</button>
        <button className="btn primary" type="button" onClick={() => void handleSyncSystemDepartmentsToFeishu()} disabled={syncingDepartments || (departmentSync?.summary.pending ?? 0) === 0}>
          {syncingDepartments ? '同步中...' : '系统部门同步到飞书'}
        </button>
        <button className="btn" type="button" onClick={() => void handleFillSystemDepartmentsFromFeishu()} disabled={syncingDepartments}>
          从飞书补齐系统空部门
        </button>
      </div>
      {departmentSync && (
        <div className="resource-maintenance-hint" style={{ marginBottom: '0.75rem' }}>
          部门同步：共 {departmentSync.summary.total} 人，已一致 {departmentSync.summary.matched}，待同步 {departmentSync.summary.pending}，系统未分配 {departmentSync.summary.systemUnassigned}，未匹配 {departmentSync.summary.unmatched}
        </div>
      )}

      <div className="dashboard-board-tabs">
        {(['people', 'allocations', 'availability'] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} type="button" onClick={() => setTab(item)}>
            {tabTitle(item)}
          </button>
        ))}
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <datalist id="resource-role-options">
        {options.roles.map((item) => <option key={item} value={item} />)}
      </datalist>
      <datalist id="resource-department-options">
        {departmentOptions.map((item) => <option key={item} value={item} />)}
      </datalist>
      <datalist id="resource-level-options">
        {options.levels.map((item) => <option key={item} value={item} />)}
      </datalist>
      <datalist id="resource-location-options">
        {options.locations.map((item) => <option key={item} value={item} />)}
      </datalist>
      <datalist id="resource-status-options">
        {options.statuses.map((item) => <option key={item} value={item} />)}
      </datalist>
      <datalist id="resource-allocation-type-options">
        {options.allocationTypes.map((item) => <option key={item} value={item} />)}
      </datalist>
      <datalist id="resource-availability-type-options">
        {options.availabilityTypes.map((item) => <option key={item} value={item} />)}
      </datalist>

      <div className="resource-maintenance-grid">
        <form className="card resource-maintenance-form" onSubmit={submit}>
          <h3>{form.recordId ? `编辑${tabTitle(tab)}` : `新增${tabTitle(tab)}`}</h3>
          {tab === 'people' && (
            <>
              <input placeholder="人员ID *" value={form.personId} onChange={(e) => setField('personId', e.target.value)} />
              <input placeholder="姓名 *" value={form.name} onChange={(e) => setField('name', e.target.value)} />
              <input list="resource-role-options" placeholder="角色 *（可选可填）" value={form.role} onChange={(e) => setField('role', e.target.value)} />
              <input list="resource-department-options" placeholder="部门 *（可选可填）" value={form.department} onChange={(e) => setField('department', e.target.value)} />
              <input list="resource-level-options" placeholder="职级（可选可填）" value={form.level} onChange={(e) => setField('level', e.target.value)} />
              <input list="resource-location-options" placeholder="地点（可选可填）" value={form.location} onChange={(e) => setField('location', e.target.value)} />
              <input placeholder="日标准产能" value={form.dailyCapacity} onChange={(e) => setField('dailyCapacity', e.target.value)} />
              <input list="resource-status-options" placeholder="状态（可选可填）" value={form.status} onChange={(e) => setField('status', e.target.value)} />
            </>
          )}
          {tab === 'allocations' && (
            <>
              <select value={form.personId} onChange={(e) => applyPerson(e.target.value)}>
                <option value="">选择人员后自动带出ID/姓名/角色</option>
                {options.people.map((person) => (
                  <option key={person.personId} value={person.personId}>{person.name} · {person.role} · {person.personId}</option>
                ))}
              </select>
              <input placeholder="人员ID *" value={form.personId} onChange={(e) => setField('personId', e.target.value)} />
              <input placeholder="姓名 *" value={form.name} onChange={(e) => setField('name', e.target.value)} />
              <select value={form.projectId} onChange={(e) => applyProject(e.target.value)}>
                <option value="">选择系统项目，或手动填写项目名称</option>
                {options.projects.map((project) => (
                  <option key={project.projectId} value={project.projectId}>{project.projectName} · #{project.projectId}</option>
                ))}
              </select>
              {form.projectId && (
                <p className="resource-maintenance-hint">项目周期：{selectedProjectPeriod}</p>
              )}
              <input placeholder="项目ID（选择系统项目后自动带出）" value={form.projectId} onChange={(e) => setField('projectId', e.target.value)} />
              <input placeholder="项目名称 *（可手动新增临时项目名）" value={form.projectName} onChange={(e) => setField('projectName', e.target.value)} />
              <input list="resource-role-options" placeholder="角色 *（可选可填）" value={form.role} onChange={(e) => setField('role', e.target.value)} />
              <div className="resource-maintenance-inline-fields">
                <label className="resource-maintenance-field">
                  <span>人员投入开始日期</span>
                  <input type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
                </label>
                <label className="resource-maintenance-field">
                  <span>人员投入结束日期</span>
                  <input type="date" value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} />
                </label>
              </div>
              <p className="resource-maintenance-hint">这里填写该人员实际参与该项目的时间，不是项目整体周期。</p>
              <input placeholder="投入比例 0-200" value={form.allocationPercent} onChange={(e) => setField('allocationPercent', e.target.value)} />
              <input placeholder="投入人天" value={form.allocationDays} onChange={(e) => setField('allocationDays', e.target.value)} />
              <p className="resource-maintenance-hint">填写投入人天后，会按“投入人天 ÷ 人员投入天数 ÷ 日标准产能”自动反算投入比例。</p>
              <input list="resource-allocation-type-options" placeholder="分配类型（可选可填）" value={form.allocationType} onChange={(e) => setField('allocationType', e.target.value)} />
            </>
          )}
          {tab === 'availability' && (
            <>
              <select value={form.personId} onChange={(e) => applyPerson(e.target.value)}>
                <option value="">选择人员后自动带出ID/姓名</option>
                {options.people.map((person) => (
                  <option key={person.personId} value={person.personId}>{person.name} · {person.role} · {person.personId}</option>
                ))}
              </select>
              <input placeholder="人员ID *" value={form.personId} onChange={(e) => setField('personId', e.target.value)} />
              <input placeholder="姓名 *" value={form.name} onChange={(e) => setField('name', e.target.value)} />
              <input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} />
              <input placeholder="可用比例 0-200" value={form.availablePercent} onChange={(e) => setField('availablePercent', e.target.value)} />
              <input list="resource-availability-type-options" placeholder="不可用类型 *（可选可填）" value={form.availabilityType} onChange={(e) => setField('availabilityType', e.target.value)} />
              <input placeholder="原因" value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
            </>
          )}
          <textarea placeholder="备注" value={form.remark} onChange={(e) => setField('remark', e.target.value)} />
          <div className="panel-actions">
            <button className="btn primary" type="submit" disabled={saving}>{saving ? '同步中...' : '同步飞书'}</button>
            <button className="btn" type="button" onClick={() => setForm(emptyForm)}>清空</button>
          </div>
        </form>

        <section className="card resource-maintenance-list">
          <div className="section-title-row">
            <h3>{tabTitle(tab)}列表</h3>
            <input placeholder="搜索当前表" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
          {loading ? (
            <AsyncStatePanel tone="loading" title="正在加载资源维护数据" />
          ) : (
            <div className="resource-maintenance-table-wrap">
              <table className="table table-compact resource-maintenance-table">
                <thead>
                  <tr>
                    <th>飞书记录ID</th>
                    {currentColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.recordId}>
                      <td className="resource-maintenance-record-id">{row.recordId}</td>
                      {currentColumns.map((column) => (
                        <td key={column}>{column === '部门同步' ? syncStatusText(row.recordId) : field(row, column) || '-'}</td>
                      ))}
                      <td><button className="btn" type="button" onClick={() => setForm(rowToForm(row, tab))}>编辑</button></td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 && (
                    <tr><td colSpan={currentColumns.length + 2}>暂无数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
