import { api } from './api';
import type { CustomerListResponse } from '../types/customer';
import type { CustomerOrdersResponse, CustomerSummary } from '@worknoon/shared-types';

export function getCustomers(signal?: AbortSignal): Promise<CustomerListResponse> {
  return api.get<CustomerListResponse>('/customers', { signal });
}

export function getCustomer(customerId: string, signal?: AbortSignal): Promise<CustomerSummary> {
  return api.get<CustomerSummary>(`/customers/${encodeURIComponent(customerId)}`, { signal });
}

export function getCustomerOrders(customerId: string, signal?: AbortSignal): Promise<CustomerOrdersResponse> {
  return api.get<CustomerOrdersResponse>(`/customers/${encodeURIComponent(customerId)}/orders`, { signal });
}
