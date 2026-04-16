type AsyncStatePanelProps = {
  title: string;
  description?: string;
  tone?: 'loading' | 'empty' | 'error';
  action?: React.ReactNode;
};

export default function AsyncStatePanel({
  title,
  description,
  tone = 'empty',
  action
}: AsyncStatePanelProps) {
  const icon = tone === 'loading' ? '◌' : tone === 'error' ? '⚠' : '⌁';

  return (
    <div className={`async-state-panel is-${tone}`}>
      <div className="async-state-panel-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="async-state-panel-body">
        <div className="async-state-panel-title">{title}</div>
        {description ? <div className="async-state-panel-description">{description}</div> : null}
      </div>
      {action ? <div className="async-state-panel-action">{action}</div> : null}
    </div>
  );
}
