import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

export default function TableToolbar({ children, className = '' }: Props) {
  return (
    <div className={`table-toolbar glass-surface glass-surface--interactive ${className}`.trim()}>
      {children}
    </div>
  );
}
