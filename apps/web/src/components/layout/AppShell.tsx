import type { ReactNode } from 'react';
import { Header } from './Header';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Header />
      <div className="app-main" id="main-content">
        {children}
      </div>
    </div>
  );
}
