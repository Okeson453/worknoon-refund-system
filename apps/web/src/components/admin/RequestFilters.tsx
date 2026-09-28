import { Button } from '../common/Button';
import { formatRelative } from '../../utils/formatDate';
import type { DashboardFilters } from '../../types/dashboard';

const DECISIONS: Array<{ value: DashboardFilters['decision']; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DENIED', label: 'Denied' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'PENDING', label: 'Pending' },
];

export interface RequestFiltersProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdatedAt: Date | null;
}

export function RequestFilters({ filters, onChange, onRefresh, isRefreshing, lastUpdatedAt }: RequestFiltersProps): JSX.Element {
  return (
    <div className="filter-bar">
      <div className="filter-group" role="group" aria-label="Filter by decision">
        <span className="filter-group__label" id="decision-filter-label">
          Decision
        </span>
        {DECISIONS.map((decision) => (
          <button
            key={decision.value}
            type="button"
            className="filter-chip"
            aria-pressed={filters.decision === decision.value}
            onClick={() => onChange({ ...filters, decision: decision.value, page: 1 })}
          >
            {decision.label}
          </button>
        ))}
      </div>

      <div className="filter-group">
        <span className="inline-note">
          Auto-refreshes every 10s{lastUpdatedAt ? ` · updated ${formatRelative(lastUpdatedAt.toISOString())}` : ''}
        </span>
        <Button size="small" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? 'Refreshing…' : 'Refresh now'}
        </Button>
      </div>
    </div>
  );
}
