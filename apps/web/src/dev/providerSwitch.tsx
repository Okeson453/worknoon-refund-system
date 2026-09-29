import type { ReactNode } from 'react';
import { DevSessionProvider } from './SessionContext';

export interface SessionProviderProps {
  children: ReactNode;
}

/** Dev build: mount the telemetry bus the overlay reads from. */
export const SessionProvider = DevSessionProvider;
