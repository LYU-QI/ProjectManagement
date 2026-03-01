import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export default function TableToolbar({ children }: Props) {
  return (
    <div className="table-toolbar glass-surface glass-surface--interactive">
      {children}
    </div>
  );
}
