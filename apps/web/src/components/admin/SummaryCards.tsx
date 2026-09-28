import { Spinner } from '../common/Spinner';
import type { DashboardSummary } from '../../types/dashboard';

export interface SummaryCardsProps {
  summary: DashboardSummary | null;
  isRefreshing: boolean;
}

interface CardSpec {
  key: keyof DashboardSummary;
  label: string;
  hint: string;
  tone?: 'positive' | 'negative' | 'caution';
}

const CARDS: CardSpec[] = [
  { key: 'total', label: 'Total', hint: 'All refund requests' },
  { key: 'approved', label: 'Approved', hint: 'Automatic approval', tone: 'positive' },
  { key: 'denied', label: 'Denied', hint: 'Deterministic denial', tone: 'negative' },
  { key: 'escalated', label: 'Escalated', hint: 'Waiting for a specialist', tone: 'caution' },
  { key: 'pending', label: 'Pending', hint: 'Not decided yet' },
  { key: 'suspicious', label: 'Flagged', hint: 'Prompt-injection signals', tone: 'caution' },
  { key: 'aiFailures', label: 'AI failures', hint: 'Decided without AI signals' },
];

export function SummaryCards({ summary, isRefreshing }: SummaryCardsProps): JSX.Element {
  return (
    <div className="summary-grid" aria-label="Decision summary">
      {CARDS.map((card) => {
        const value = summary?.[card.key];
        const toneClass = card.tone ? ` summary-card__value--${card.tone}` : '';
        return (
          <article key={card.key} className="summary-card">
            <p className="summary-card__label">{card.label}</p>
            <p className={`summary-card__value${toneClass}`}>{value ?? '—'}</p>
            <p className="summary-card__hint">
              {card.hint}
              {card.key === 'aiFailures' && isRefreshing ? ' · refreshing…' : ''}
            </p>
          </article>
        );
      })}
    </div>
  );
}

export function SummaryCardsSkeleton(): JSX.Element {
  return (
    <div className="summary-grid" role="status" aria-label="Loading summary">
      {CARDS.map((card) => (
        <div key={card.key} className="summary-card">
          <p className="summary-card__label">{card.label}</p>
          <Spinner size="md" label={`Loading ${card.label}`} />
        </div>
      ))}
    </div>
  );
}
