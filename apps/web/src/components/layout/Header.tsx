import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../../services/api';
import type { HealthResponse } from '../../types/api';

type HealthState = 'checking' | 'ok' | 'degraded' | 'down';

const HEALTH_LABEL: Record<HealthState, string> = {
  checking: 'Checking service…',
  ok: 'Service healthy',
  degraded: 'Service degraded',
  down: 'Service unreachable',
};

export function Header(): JSX.Element {
  const [state, setState] = useState<HealthState>('checking');
  const [detail, setDetail] = useState<string>('');

  useEffect(() => {
    const controller = new AbortController();
    const poll = (): void => {
      api
        .get<HealthResponse>('/health', { signal: controller.signal })
        .then((health) => {
          setState(health.status === 'ok' ? 'ok' : 'degraded');
          setDetail(`db ${health.database} · ai ${health.ai}`);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setState('down');
            setDetail('no response from the API');
          }
        });
    };
    poll();
    const timer = window.setInterval(poll, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <NavLink to="/" className="brand">
          <span className="brand__mark" aria-hidden="true">
            W
          </span>
          <span>
            WORKNOON
            <span className="brand__meta">Refund support</span>
          </span>
        </NavLink>

        <span
          className={`health-pill health-pill--${state === 'checking' ? '' : state}`.trim()}
          title={detail}
          role="status"
          aria-live="polite"
        >
          <span className="health-pill__dot" aria-hidden="true" />
          {HEALTH_LABEL[state]}
        </span>

        <nav className="app-nav" aria-label="Primary">
          <NavLink to="/" className="app-nav__link" end>
            Customer
          </NavLink>
          <NavLink to="/admin" className="app-nav__link">
            Support
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
