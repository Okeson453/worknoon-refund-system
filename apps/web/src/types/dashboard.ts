export type { DashboardSummary } from '@worknoon/shared-types';

export interface DashboardFilters {
  decision: 'ALL' | 'APPROVED' | 'DENIED' | 'ESCALATED' | 'PENDING';
  page: number;
  limit: number;
}
