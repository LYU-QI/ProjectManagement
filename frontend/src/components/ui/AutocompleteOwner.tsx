import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
};

export default function AutocompleteOwner({ value, onChange, options, placeholder = '输入或选择', disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setInput(value); }, [value]);

  const filtered = useMemo(() => {
    if (!input) return [];
    const q = input.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, input]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const commit = (v: string) => {
    onChange(v);
    setInput(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={input}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setInput(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
          if (e.key === 'Enter' && filtered.length === 1) commit(filtered[0]);
        }}
        style={{ width: '100%' }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 99999,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            maxHeight: 240,
            overflowY: 'auto',
            marginTop: 4,
          }}
        >
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => commit(opt)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem 0.75rem',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--glass-border)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
