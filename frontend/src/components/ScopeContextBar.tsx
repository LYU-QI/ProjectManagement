type Props = {
  moduleLabel: string;
  orgName?: string | null;
  projectName?: string | null;
  projectId?: number | null;
  scopeLabel: string;
  sourceLabel?: string;
  note?: string;
};

export default function ScopeContextBar({
  moduleLabel,
  orgName,
  projectName,
  projectId,
  scopeLabel,
  sourceLabel,
  note
}: Props) {
  const displayProject = projectName && projectName !== '未选择'
    ? `${projectName}${projectId ? ` (#${projectId})` : ''}`
    : '未选择';

  return (
    <div className="scope-context-bar card compact-card">
      <div className="scope-context-bar-head">
        <h3>{moduleLabel}</h3>
        <span className="scope-context-badge">{scopeLabel}</span>
      </div>
      <div className="scope-context-meta">
        <span><strong>组织</strong>{orgName || '未选择'}</span>
        <span><strong>项目</strong>{displayProject}</span>
        {sourceLabel ? <span><strong>数据源</strong>{sourceLabel}</span> : null}
      </div>
      {note ? <div className="scope-context-note">{note}</div> : null}
    </div>
  );
}
