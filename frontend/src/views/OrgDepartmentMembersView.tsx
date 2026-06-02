import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../api/client';
import { ImportMemberDepartmentsResult, importOrgMemberDepartments, listOrgMembers, updateOrgMemberDepartment } from '../api/organizations';
import { useOrgStore } from '../store/useOrgStore';
import AsyncStatePanel from '../components/AsyncStatePanel';

interface OrgMember {
  userId: number;
  name: string;
  username: string;
  globalRole: string;
  orgRole: 'owner' | 'admin' | 'member' | 'viewer';
  departmentId?: string | null;
  departmentName?: string | null;
  joinedAt: string;
}

interface DepartmentItem {
  id: string;
  name: string;
  parentId: string | null;
  children?: DepartmentItem[];
}

interface DepartmentOption {
  id: string;
  label: string;
}

interface OrgDepartmentMembersViewProps {
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

const ORG_ROLE_LABELS: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
  viewer: '访客'
};

const GLOBAL_ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  project_manager: '项目主管',
  dept_head: '部门负责人',
  pm: '项目经理',
  member: '成员',
  viewer: '访客'
};

function flattenDepartments(items: DepartmentItem[], prefix = ''): DepartmentOption[] {
  return items.flatMap((item) => {
    const label = prefix ? `${prefix} / ${item.name}` : item.name;
    return [
      { id: item.id, label },
      ...flattenDepartments(item.children ?? [], label)
    ];
  });
}

export default function OrgDepartmentMembersView({ onError, onMessage }: OrgDepartmentMembersViewProps) {
  const { activeOrgId } = useOrgStore();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportMemberDepartmentsResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function load() {
    if (!activeOrgId) return;
    setLoading(true);
    Promise.all([
      listOrgMembers(activeOrgId),
      apiGet<DepartmentItem[]>('/departments')
    ])
      .then(([memberData, deptData]) => {
        setMembers(memberData);
        setDepartments(deptData);
      })
      .catch((err: Error) => onError(err.message || '加载部门成员失败'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [activeOrgId]);

  const departmentOptions = useMemo(() => flattenDepartments(departments), [departments]);
  const departmentLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of departmentOptions) map.set(item.id, item.label);
    return map;
  }, [departmentOptions]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      const departmentName = member.departmentId ? departmentLabelById.get(member.departmentId) ?? member.departmentName ?? '' : '未分配';
      return `${member.name} ${member.username} ${departmentName}`.toLowerCase().includes(q);
    });
  }, [departmentLabelById, members, search]);

  async function handleDepartmentChange(member: OrgMember, value: string) {
    if (!activeOrgId) return;
    const departmentId = value || null;
    setUpdatingUserId(member.userId);
    try {
      await updateOrgMemberDepartment(activeOrgId, String(member.userId), departmentId);
      setMembers((prev) => prev.map((item) => item.userId === member.userId
        ? {
          ...item,
          departmentId,
          departmentName: departmentId ? departmentLabelById.get(departmentId) ?? null : null
        }
        : item
      ));
      onMessage(`${member.name} 的部门已更新`);
    } catch (err) {
      onError(err instanceof Error ? err.message : '更新部门失败');
    } finally {
      setUpdatingUserId(null);
    }
  }

  function downloadTemplate() {
    const lines = [
      ['用户名', '姓名', '部门'],
      ...members.map((member) => [
        member.username,
        member.name,
        member.departmentId ? departmentLabelById.get(member.departmentId) ?? member.departmentName ?? '' : '未分配'
      ])
    ];
    const csv = lines.map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '部门成员导入模板.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeOrgId) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importOrgMemberDepartments(activeOrgId, file);
      setImportResult(result);
      await Promise.all([
        listOrgMembers(activeOrgId).then(setMembers),
        apiGet<DepartmentItem[]>('/departments').then(setDepartments)
      ]);
      onMessage(`导入完成：成功 ${result.summary.success} 行，失败 ${result.summary.failed} 行，跳过 ${result.summary.skipped} 行`);
    } catch (err) {
      onError(err instanceof Error ? err.message : '导入部门成员失败');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>部门成员</h2>

      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="glass-input"
            placeholder="搜索成员、用户名或部门..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 260, flex: 1 }}
          />
          <button className="btn" type="button" onClick={load}>刷新</button>
          <button className="btn" type="button" onClick={downloadTemplate}>下载模板</button>
          <button
            className="btn primary"
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? '导入中...' : '导入 Excel'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(event) => void handleImportFileChange(event)}
          />
        </div>
        <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
          导入字段支持“用户名 / 姓名 / 部门”。优先按用户名匹配成员；部门可填完整路径，例如“研发部 / 前端组”；空白或“未分配”会清空部门。
        </p>
        {departmentOptions.length === 0 && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
            当前组织还没有部门。可以先到“部门管理”新建部门，或将成员保持为未分配。
          </p>
        )}
      </div>

      {importResult && (
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            最近一次导入：共 {importResult.summary.total} 行，成功 {importResult.summary.success} 行，失败 {importResult.summary.failed} 行，跳过 {importResult.summary.skipped} 行
          </div>
          {importResult.results.some((item) => item.status !== 'success') && (
            <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              {importResult.results.filter((item) => item.status !== 'success').slice(0, 10).map((item) => (
                <div key={`${item.row}-${item.message}`}>
                  第 {item.row} 行：{item.message}
                  {item.username || item.name ? `（${item.username || item.name}）` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <AsyncStatePanel
          tone="loading"
          title="正在加载部门成员"
          description="正在读取当前组织成员和部门树。"
        />
      )}

      {!loading && filteredMembers.length === 0 && (
        <AsyncStatePanel
          tone="empty"
          title="暂无匹配成员"
          description="当前筛选条件下没有可展示的组织成员。"
        />
      )}

      {!loading && filteredMembers.length > 0 && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {filteredMembers.map((member) => (
            <div key={member.userId} className="glass-card" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 320px)', gap: '1rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: '#fff', flexShrink: 0 }}>
                  {member.name.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{member.name}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    @{member.username} · 全局角色: {GLOBAL_ROLE_LABELS[member.globalRole] || member.globalRole} · 组织角色: {ORG_ROLE_LABELS[member.orgRole] || member.orgRole}
                  </div>
                </div>
              </div>
              <select
                className="glass-input"
                value={member.departmentId ?? ''}
                disabled={updatingUserId === member.userId}
                onChange={(e) => void handleDepartmentChange(member, e.target.value)}
              >
                <option value="">未分配</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>{department.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
