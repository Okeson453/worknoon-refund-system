import { useEffect, useState } from 'react';
import { getCustomerOrders } from '../services/customers';
import { ApiRequestError } from '../services/api';
import type { OrderSummary } from '../types/customer';

export interface UseOrdersResult {
  orders: OrderSummary[];
  isLoading: boolean;
  error: string | null;
}

export function useOrders(customerId: string | null): UseOrdersResult {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId === null) {
      setOrders([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    getCustomerOrders(customerId, controller.signal)
      .then((response) => {
        setOrders(response.items);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof ApiRequestError ? cause.message : 'Could not load the orders for this customer.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [customerId]);

  return { orders, isLoading, error };
}
