import { useCallback, useEffect, useRef, useState } from 'react';
import { getDashboardSummary } from '../services/dashboard';
import { listRefundRequests } from '../services/refunds';
import { ApiRequestError } from '../services/api';
import type { DashboardSummary } from '../types/dashboard';
import type { RefundRequestListItem, RefundRequestListResponse } from '../types/refund';
import type { RefundStatus } from '@worknoon/shared-types';

export const REFRESH_INTERVAL_MS = 10_000;

export interface UseDashboardOptions {
  decision: RefundStatus | 'ALL';
  page: number;
  limit: number;
}

export interface UseDashboardResult {
  summary: DashboardSummary | null;
  requests: RefundRequestListItem[];
  pagination: RefundRequestListResponse['pagination'] | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  refetch: () => void;
}

/** Dashboard data with a polling refresh, so support sees new decisions without reloading. */
export function useDashboard(options: UseDashboardOptions): UseDashboardResult {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [requests, setRequests] = useState<RefundRequestListItem[]>([]);
  const [pagination, setPagination] = useState<RefundRequestListResponse['pagination'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [nonce, setNonce] = useState(0);
  const hasLoaded = useRef(false);
  const inFlight = useRef<AbortController | null>(null);

  const { decision, page, limit } = options;

  const load = useCallback(
    async (signal: AbortSignal, background: boolean): Promise<void> => {
      if (background) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const [summaryResponse, listResponse] = await Promise.all([
          getDashboardSummary(signal),
          listRefundRequests({ decision: decision === 'ALL' ? undefined : decision, page, limit }, signal),
        ]);
        if (signal.aborted) return;
        setSummary(summaryResponse);
        setRequests(listResponse.items);
        setPagination(listResponse.pagination);
        setError(null);
        setLastUpdatedAt(new Date());
        hasLoaded.current = true;
      } catch (cause) {
        if (signal.aborted) return;
        setError(cause instanceof ApiRequestError ? cause.message : 'Could not load the support dashboard.');
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [decision, page, limit],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal, hasLoaded.current);
    return () => controller.abort();
  }, [load, nonce]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      // Skip hidden tabs and never overlap with a request that is still running.
      if (document.visibilityState !== 'visible' || inFlight.current !== null) return;
      const controller = new AbortController();
      inFlight.current = controller;
      void load(controller.signal, true).finally(() => {
        if (inFlight.current === controller) inFlight.current = null;
      });
    }, REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, [load]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  return { summary, requests, pagination, isLoading, isRefreshing, error, lastUpdatedAt, refetch };
}
