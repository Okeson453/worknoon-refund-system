import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = '∅', title, description, action }: EmptyStateProps) {
  return (
    <div className="state-block">
      <span className="state-block__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="state-block__title">{title}</p>
      {description ? <p className="state-block__description">{description}</p> : null}
      {action}
    </div>
  );
}
