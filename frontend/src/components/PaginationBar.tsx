type Props = {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  summary?: string;
};

export default function PaginationBar({ onPrev, onNext, hasPrev, hasNext, summary }: Props) {
  return (
    <div className="pagination-bar">
      <button className="btn" type="button" onClick={onPrev} disabled={!hasPrev}>上一页</button>
      <button className="btn" type="button" onClick={onNext} disabled={!hasNext}>下一页</button>
      {summary && <span className="pagination-summary">{summary}</span>}
    </div>
  );
}
