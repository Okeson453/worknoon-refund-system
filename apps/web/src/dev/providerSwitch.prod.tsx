import type { ReactNode } from 'react';
import { DevSessionProvider } from './SessionContext';

/**
 * Production stand-in for the dev session provider.
 *
 * `DevSessionProvider` itself is inert unless `import.meta.env.DEV` is true — it only holds state and
 * renders its children — but the production build selects this trivial pass-through anyway so no dev
 * machinery survives into the shipped bundle.
 */
export interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps): JSX.Element {
  void DevSessionProvider;
  return <>{children}</>;
}
