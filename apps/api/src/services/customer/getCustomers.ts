import type { CustomerSummary } from '@worknoon/shared-types';
import { listCustomers } from '../../database/repositories/customer.repository';
import { notFoundError } from '../../utils/errors';
import { findCustomerById } from '../../database/repositories/customer.repository';

export interface CustomerListResponse {
  items: CustomerSummary[];
}

/** Synthetic CRM selector data for the demo customer switcher. */
export async function getCustomers(): Promise<CustomerListResponse> {
  const customers = await listCustomers();
  return { items: customers.map((customer) => ({ id: customer.id, name: customer.name, email: customer.email })) };
}

export async function getCustomer(id: string): Promise<CustomerSummary> {
  const customer = await findCustomerById(id);
  if (customer === null) throw notFoundError('Customer not found.');
  return { id: customer.id, name: customer.name, email: customer.email };
}
