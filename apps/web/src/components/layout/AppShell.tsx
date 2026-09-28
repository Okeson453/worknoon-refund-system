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
      <footer className="app-footer">
        <div className="app-footer__inner">
          <p>WORKNOON Full Stack AI Integration challenge — synthetic data only, no real payments.</p>
          <p>
            Decisions are produced by a deterministic policy engine. The AI interprets and explains, it never authorizes.
          </p>
        </div>
      </footer>
    </div>
  );
}
