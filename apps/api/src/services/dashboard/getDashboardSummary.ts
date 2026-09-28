import type { DashboardSummary } from '@worknoon/shared-types';
import { getDashboardCounts } from '../../database/repositories/refund.repository';

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return getDashboardCounts();
}
