import type { ReactNode } from 'react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  requestId?: string | null;
  onRetry?: () => void;
  action?: ReactNode;
}

export function ErrorState({ title = 'Something went wrong', message, requestId, onRetry, action }: ErrorStateProps) {
  return (
    <div className="state-block" role="alert">
      <span className="state-block__icon" aria-hidden="true">
        !
      </span>
      <p className="state-block__title">{title}</p>
      <p className="state-block__description">{message}</p>
      {requestId ? <p className="state-block__description">Request id: {requestId}</p> : null}
      {onRetry ? (
        <Button variant="primary" size="small" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
      {action}
    </div>
  );
}
