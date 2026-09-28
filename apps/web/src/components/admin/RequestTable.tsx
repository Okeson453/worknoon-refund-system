import { RefundStatusBadge } from '../refund/RefundStatus';
import { SuspiciousBadge } from './SuspiciousBadge';
import { EmptyState } from '../common/EmptyState';
import { Spinner } from '../common/Spinner';
import { Button } from '../common/Button';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateTime, formatRelative } from '../../utils/formatDate';
import { refundReasonLabel } from '../../utils/status';
import type { DashboardFilters } from '../../types/dashboard';
import type { RefundRequestListItem, RefundRequestListResponse } from '../../types/refund';

export interface RequestTableProps {
  items: RefundRequestListItem[];
  pagination: RefundRequestListResponse['pagination'] | null;
  filters: DashboardFilters;
  isLoading: boolean;
  selectedRequestId: string | null;
  onSelect: (id: string) => void;
  onPageChange: (filters: DashboardFilters) => void;
}

export function RequestTable({
  items,
  pagination,
  filters,
  isLoading,
  selectedRequestId,
  onSelect,
  onPageChange,
}: RequestTableProps): JSX.Element {
  if (isLoading && items.length === 0) {
    return (
      <div className="state-block" role="status">
        <Spinner size="lg" label="Loading refund requests" />
        <p className="state-block__description">Loading recent refund requests…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="⌕"
        title="No refund requests match this filter"
        description="Change the decision filter, or submit a request from the customer view."
      />
    );
  }

  const page = pagination?.page ?? 1;
  const pages = pagination?.pages ?? 1;

  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <caption>Newest first. Select a row to inspect the full decision trail.</caption>
          <thead>
            <tr>
              <th scope="col">Request</th>
              <th scope="col">Customer</th>
              <th scope="col">Order</th>
              <th scope="col">Amount</th>
              <th scope="col">Decision</th>
              <th scope="col">Reason</th>
              <th scope="col">Signals</th>
              <th scope="col">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                aria-selected={item.id === selectedRequestId}
                tabIndex={0}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(item.id);
                  }
                }}
              >
                <td className="data-table__id">RF-{String(item.displayId).padStart(4, '0')}</td>
                <td>{item.customerId}</td>
                <td className="data-table__id">{item.orderId}</td>
                <td>{formatCurrency(item.refundAmountCents)}</td>
                <td>
                  <RefundStatusBadge status={item.status} />
                </td>
                <td>{refundReasonLabel(item.detectedReason)}</td>
                <td>
                  <SuspiciousBadge suspicious={item.suspicious} aiUsed={item.aiUsed} />
                </td>
                <td title={formatDateTime(item.createdAt)}>{formatRelative(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="pagination" aria-label="Pagination">
        <span>
          {pagination ? `${pagination.total} request(s) · page ${pagination.page} of ${Math.max(pagination.pages, 1)}` : 'No pagination data'}
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => onPageChange({ ...filters, page: page - 1 })}
          >
            Previous
          </Button>
          <Button
            size="small"
            variant="ghost"
            disabled={page >= pages}
            onClick={() => onPageChange({ ...filters, page: page + 1 })}
          >
            Next
          </Button>
        </span>
      </nav>
    </>
  );
}
