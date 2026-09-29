import { Component, createContext, useCallback, useContext, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '../components/common/ErrorState';
import { useDevSession } from '../dev/SessionContext';

export interface Toast {
  id: number;
  tone: 'success' | 'error';
  title: string;
  message?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) throw new Error('useToast must be used inside AppProviders');
  return context;
}

let toastCounter = 0;

function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Null in a production build, so the recording overlay can never affect the shipped bundle.
  const devSession = useDevSession();

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      toastCounter += 1;
      const id = toastCounter;
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), 6000);
      devSession?.record({ tone: toast.tone, title: toast.title, message: toast.message ?? '' });
    },
    [dismissToast, devSession],
  );

  const value = useMemo(() => ({ toasts, pushToast, dismissToast }), [toasts, pushToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
            <p className="toast__title">{toast.title}</p>
            {toast.message ? <p className="toast__message">{toast.message}</p> : null}
            <button type="button" className="button button--ghost button--small" onClick={() => dismissToast(toast.id)}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="page-container page-container--narrow">
          <ErrorState
            title="The page could not be rendered"
            message={this.state.error.message}
            onRetry={() => this.setState({ error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

/** Application-wide providers: crash boundary plus transient notifications. */
export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ErrorBoundary>
      <ToastProvider>{children}</ToastProvider>
    </ErrorBoundary>
  );
}
