import { useCallback, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { SummaryCards, SummaryCardsSkeleton } from '../components/admin/SummaryCards';
import { RequestFilters } from '../components/admin/RequestFilters';
import { RequestTable } from '../components/admin/RequestTable';
import { RequestDetailDrawer } from '../components/admin/RequestDetailDrawer';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ErrorState } from '../components/common/ErrorState';
import { useDashboard } from '../hooks/useDashboard';
import { getAdminKey, setAdminKey } from '../services/api';
import type { DashboardFilters } from '../types/dashboard';

const DEFAULT_FILTERS: DashboardFilters = { decision: 'ALL', page: 1, limit: 25 };

export function AdminDashboardPage(): JSX.Element {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [adminKey, setAdminKeyState] = useState(getAdminKey());

  const { summary, requests, pagination, isLoading, isRefreshing, error, lastUpdatedAt, refetch } = useDashboard(filters);

  const handleApplyAdminKey = useCallback(() => {
    setAdminKey(adminKey.trim());
    refetch();
  }, [adminKey, refetch]);

  const handleFiltersChange = useCallback((next: DashboardFilters) => {
    setFilters(next);
  }, []);

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Support dashboard</h1>
          <p className="page-header__subtitle">
            Every request, the rules that fired, what the model produced and the immutable audit trail.
          </p>
        </div>
        <p className="page-header__meta">Auto-refresh · 10 seconds</p>
      </div>

      {isLoading && summary === null ? <SummaryCardsSkeleton /> : <SummaryCards summary={summary} isRefreshing={isRefreshing} />}

      <div className="admin-toolbar">
        <RequestFilters
          filters={filters}
          onChange={handleFiltersChange}
          onRefresh={refetch}
          isRefreshing={isRefreshing}
          lastUpdatedAt={lastUpdatedAt}
        />

        <div className="admin-toolbar__row">
          <p className="inline-note">
            If <code>ADMIN_API_KEY</code> is set, paste it here. It is kept in this browser tab only and never shipped with
            the bundle.
          </p>
          <div className="admin-toolbar__key">
            <div className="form-field">
              <label className="form-field__label" htmlFor="admin-key">
                Admin key
              </label>
              <input
                id="admin-key"
                className="form-field__control"
                type="password"
                value={adminKey}
                autoComplete="off"
                onChange={(event) => setAdminKeyState(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleApplyAdminKey();
                }}
                placeholder="optional"
              />
            </div>
            <Button size="small" onClick={handleApplyAdminKey}>
              Apply
            </Button>
          </div>
        </div>
      </div>

      <Card title="Refund requests" hint="Newest first" bodyClassName="">
        {error !== null ? <ErrorState message={error} onRetry={refetch} /> : null}

        {!error ? (
          <RequestTable
            items={requests}
            pagination={pagination}
            filters={filters}
            isLoading={isLoading}
            selectedRequestId={selectedRequestId}
            onSelect={setSelectedRequestId}
            onPageChange={handleFiltersChange}
          />
        ) : null}
      </Card>

      <RequestDetailDrawer requestId={selectedRequestId} onClose={() => setSelectedRequestId(null)} />
    </PageContainer>
  );
}
