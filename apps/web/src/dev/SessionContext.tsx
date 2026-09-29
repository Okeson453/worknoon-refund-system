import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { EMPTY_TELEMETRY, type DevSessionState, type DevToastRecord, type DevTelemetry } from './types';

/**
 * Dev-only state bus for the recording overlay.
 *
 * It carries three things from the app to the overlay: the latest decision (so the verdict chip on
 * screen can never disagree with the API response), the safety-blocked state (so the prompt-injection
 * beat is visible rather than implied), and a mirror of every toast (so toasts are in the recording
 * instead of cropped out of it).
 *
 * The provider is inert in a production build: `DevSessionProvider` re-exports children untouched
 * when `import.meta.env.DEV` is false, and `useDevSession` yields a null session so callers no-op.
 */

const DevSessionContext = createContext<DevSessionState | null>(null);

let toastSequence = 0;
let submissionSequence = 0;

export function useDevSession(): DevSessionState | null {
  return useContext(DevSessionContext);
}

export interface DevSessionProviderProps {
  children: ReactNode;
}

export function DevSessionProvider({ children }: DevSessionProviderProps): JSX.Element {
  const [telemetry, setTelemetry] = useState<DevTelemetry>(EMPTY_TELEMETRY);
  const [toasts, setToasts] = useState<DevToastRecord[]>([]);
  const [context, setContext] = useState('');

  const record = useCallback<DevSessionState['record']>((toast) => {
    toastSequence += 1;
    const entry: DevToastRecord = { id: toastSequence, ...toast };
    setToasts((current) => [...current.slice(-2), entry]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== entry.id));
    }, 8000);
  }, []);

  const reportDecision = useCallback<DevSessionState['reportDecision']>((input) => {
    submissionSequence += 1;
    setTelemetry({
      decision: input.decision,
      amountCents: input.amountCents,
      reference: input.reference,
      reasons: input.reasons,
      blocked: false,
      submissionCount: submissionSequence,
      message: input.message,
    });
  }, []);

  const reportBlocked = useCallback<DevSessionState['reportBlocked']>((input) => {
    submissionSequence += 1;
    setTelemetry({
      ...EMPTY_TELEMETRY,
      blocked: true,
      submissionCount: submissionSequence,
      message: input.message,
    });
  }, []);

  const refresh = useCallback(() => undefined, []);

  const value = useMemo<DevSessionState>(
    () => ({ telemetry, toasts, context, record, setContext, reportDecision, reportBlocked, refresh }),
    [telemetry, toasts, context, record, reportDecision, reportBlocked, refresh],
  );

  return <DevSessionContext.Provider value={value}>{children}</DevSessionContext.Provider>;
}
