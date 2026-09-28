import type { CustomerSummary } from '@worknoon/shared-types';

export type { CustomerOrdersResponse, CustomerSummary, OrderItemDto, OrderSummary } from '@worknoon/shared-types';

export interface CustomerListResponse {
  items: CustomerSummary[];
}
