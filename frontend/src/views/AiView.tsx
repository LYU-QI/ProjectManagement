type Props = {
  aiReport: string;
  onGenerate: () => void;
};

export default function AiView({ aiReport, onGenerate }: Props) {
  return (
    <div>
      <button className="btn" onClick={onGenerate}>生成周报草稿</button>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>AI 周报草稿</h3>
        <pre>{aiReport || '点击上方按钮生成'}</pre>
      </div>
    </div>
  );
}
