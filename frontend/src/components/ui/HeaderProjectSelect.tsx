import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ProjectItem } from '../../types';

interface HeaderProjectSelectProps {
  projects: ProjectItem[];
  selectedProjectId: number | null;
  onSelect: (id: number) => void;
}

export default function HeaderProjectSelect({ projects, selectedProjectId, onSelect }: HeaderProjectSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = projects.find((p) => p.id === selectedProjectId);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '5px 10px',
          height: 36,
          fontSize: '0.82rem',
          fontWeight: 600,
          fontFamily: 'inherit',
          background: `
            linear-gradient(155deg,
              color-mix(in srgb, var(--glass-specular) 34%, transparent 66%),
              transparent 38%),
            var(--glass-bg)
          `,
          border: '1px solid var(--glass-border)',
          borderRadius: 12,
          color: 'var(--text-on-glass-primary)',
          cursor: 'pointer',
          outline: 'none',
          backdropFilter: 'saturate(140%) blur(var(--glass-blur))',
          WebkitBackdropFilter: 'saturate(140%) blur(var(--glass-blur))',
          boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--glass-specular) 48%, transparent 52%)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>项目</span>
        <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
          {selected?.name ?? '未选择'}
        </span>
        <ChevronDown size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            minWidth: 200,
            zIndex: 300,
          }}
        >
          <div
            style={{
              borderRadius: 14,
              border: '1px solid color-mix(in srgb, var(--color-primary) 30%, var(--glass-border) 70%)',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              background: `
                linear-gradient(170deg,
                  color-mix(in srgb, var(--glass-specular) 20%, transparent 80%),
                  transparent 44%),
                color-mix(in srgb, var(--glass-bg) 90%, var(--color-bg-surface) 10%)
              `,
              boxShadow: '0 18px 36px color-mix(in srgb, #000000 36%, transparent 64%)',
              backdropFilter: 'saturate(130%) blur(var(--glass-blur))',
              WebkitBackdropFilter: 'saturate(130%) blur(var(--glass-blur))',
            }}
          >
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  width: '100%',
                  minHeight: 38,
                  borderRadius: 12,
                  border: `1px solid ${p.id === selectedProjectId
                    ? 'color-mix(in srgb, var(--color-primary) 60%, var(--glass-border) 40%)'
                    : 'color-mix(in srgb, var(--color-primary) 34%, var(--glass-border) 66%)'
                  }`,
                  background: p.id === selectedProjectId
                    ? `linear-gradient(160deg,
                        color-mix(in srgb, var(--glass-specular) 22%, transparent 78%),
                        transparent 42%),
                      color-mix(in srgb, var(--glass-bg) 74%, var(--color-bg-surface) 26%)`
                    : 'transparent',
                  color: 'var(--text-on-glass-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '0 12px',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (p.id !== selectedProjectId) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--glass-bg-hover) 50%, transparent 50%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (p.id !== selectedProjectId) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }
                }}
              >
                {p.name}
              </button>
            ))}
            {projects.length === 0 && (
              <div style={{
                padding: '12px',
                fontSize: '0.8rem',
                color: 'var(--text-on-glass-secondary)',
                textAlign: 'center',
              }}>
                暂无项目
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
