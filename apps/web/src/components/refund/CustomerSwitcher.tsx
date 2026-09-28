import { Card } from '../common/Card';
import { Spinner } from '../common/Spinner';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';

export interface CustomerSwitcherProps {
  customers: Array<{ id: string; name: string; email: string }>;
  selectedCustomerId: string | null;
  onSelect: (customerId: string) => void;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  disabled?: boolean;
}

/** Demo mode stand-in for authentication: the reviewer picks who is asking for a refund. */
export function CustomerSwitcher({
  customers,
  selectedCustomerId,
  onSelect,
  isLoading,
  error,
  onRetry,
  disabled = false,
}: CustomerSwitcherProps): JSX.Element {
  return (
    <Card title="1. Customer" hint="Demo mode — no sign-in, synthetic records only">
      {isLoading ? (
        <div className="state-block" role="status">
          <Spinner label="Loading customers" />
        </div>
      ) : null}

      {!isLoading && error !== null ? <ErrorState message={error} onRetry={onRetry} /> : null}

      {!isLoading && error === null && customers.length === 0 ? (
        <EmptyState title="No customers available" description="The database has not been seeded yet." />
      ) : null}

      {!isLoading && error === null && customers.length > 0 ? (
        <div className="form-field">
          <label className="form-field__label" htmlFor="customer-select">
            Signed in as
          </label>
          <select
            id="customer-select"
            className="form-field__control"
            value={selectedCustomerId ?? ''}
            onChange={(event) => onSelect(event.target.value)}
            disabled={disabled}
          >
            <option value="">Select a customer…</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.id} — {customer.name}
              </option>
            ))}
          </select>
          <p className="form-field__hint">15 seeded customers, one per policy scenario.</p>
        </div>
      ) : null}
    </Card>
  );
}
