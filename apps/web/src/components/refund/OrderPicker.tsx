import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Spinner } from '../common/Spinner';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { ORDER_STATUS_META } from '../../utils/status';
import type { OrderSummary } from '../../types/customer';

export interface OrderPickerProps {
  orders: OrderSummary[];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  disabled?: boolean;
}

export function OrderPicker({ orders, selectedOrderId, onSelect, isLoading, error, onRetry, disabled = false }: OrderPickerProps): JSX.Element {
  return (
    <Card title="2. Order" hint={orders.length > 0 ? `${orders.length} order(s) on file` : undefined}>
      {isLoading ? (
        <div className="state-block" role="status">
          <Spinner label="Loading orders" />
        </div>
      ) : null}

      {!isLoading && error !== null ? <ErrorState message={error} onRetry={onRetry} /> : null}

      {!isLoading && error === null && orders.length === 0 ? (
        <EmptyState icon="◎" title="Select a customer first" description="Orders appear once a customer is selected." />
      ) : null}

      {!isLoading && error === null && orders.length > 0 ? (
        <div className="selection-list" role="radiogroup" aria-label="Orders">
          {orders.map((order) => {
            const status = ORDER_STATUS_META[order.status];
            const isSelected = order.id === selectedOrderId;
            return (
              <button
                key={order.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={isSelected ? 'selection-option is-selected' : 'selection-option'}
                onClick={() => onSelect(order.id)}
                disabled={disabled}
              >
                <span className="selection-option__body">
                  <span className="selection-option__title">
                    {order.id} · {formatCurrency(order.totalCents)}
                  </span>
                  <span className="selection-option__meta">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span>{formatDate(order.orderDate)}</span>
                    <span>
                      {order.items.length} item{order.items.length === 1 ? '' : 's'}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}
