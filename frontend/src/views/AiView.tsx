import { useEffect, useState } from 'react';

type Props = {
  aiReport: string;
  onGenerate: () => void;
};

export default function AiView({ aiReport, onGenerate }: Props) {
  const [draft, setDraft] = useState(aiReport);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(aiReport);
  }, [aiReport]);

  function download() {
    const blob = new Blob([draft || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={onGenerate}>生成周报草稿</button>
        <button className="btn" type="button" onClick={copy} disabled={!draft}>复制</button>
        <button className="btn" type="button" onClick={download} disabled={!draft}>下载</button>
        {copied && <span style={{ color: 'var(--neon-green)' }}>已复制</span>}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>AI 周报草稿</h3>
        <textarea
          rows={16}
          value={draft || ''}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="点击上方按钮生成"
        />
      </div>
    </div>
  );
}
