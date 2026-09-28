import { useCallback, useEffect, useState } from 'react';
import { getCustomers } from '../services/customers';
import { ApiRequestError } from '../services/api';
import type { CustomerSummary } from '../types/customer';

export interface UseCustomersResult {
  customers: CustomerSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCustomers(): UseCustomersResult {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    getCustomers(controller.signal)
      .then((response) => {
        setCustomers(response.items);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof ApiRequestError ? cause.message : 'Could not load the demo customers.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [nonce]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  return { customers, isLoading, error, refetch };
}
