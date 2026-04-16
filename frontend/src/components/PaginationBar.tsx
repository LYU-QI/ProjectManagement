type Props = {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  summary?: string;
  className?: string;
};

export default function PaginationBar({ onPrev, onNext, hasPrev, hasNext, summary, className = '' }: Props) {
  return (
    <div className={`pagination-bar ${className}`.trim()}>
      <div className="pagination-bar-actions">
        <button className="btn pagination-btn" type="button" onClick={onPrev} disabled={!hasPrev}>上一页</button>
        <button className="btn pagination-btn" type="button" onClick={onNext} disabled={!hasNext}>下一页</button>
      </div>
      {summary && <span className="pagination-summary">{summary}</span>}
    </div>
  );
}
