import { api } from './api';
import type { DashboardSummary } from '../types/dashboard';

export function getDashboardSummary(signal?: AbortSignal): Promise<DashboardSummary> {
  return api.get<DashboardSummary>('/dashboard/summary', { signal });
}
