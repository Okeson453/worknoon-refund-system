import type { CustomerOrdersResponse } from '@worknoon/shared-types';
import { listOrdersForCustomer } from '../../database/repositories/order.repository';
import { notFoundError } from '../../utils/errors';
import { findCustomerById } from '../../database/repositories/customer.repository';

export async function getCustomerOrders(customerId: string): Promise<CustomerOrdersResponse> {
  const customer = await findCustomerById(customerId);
  if (customer === null) throw notFoundError('Customer not found.');

  const orders = await listOrdersForCustomer(customerId);
  return {
    items: orders.map((order) => ({
      id: order.id,
      orderDate: order.orderDate.toISOString(),
      status: order.status,
      totalCents: order.totalCents,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        priceCents: item.priceCents,
        finalSale: item.finalSale,
        damaged: item.damaged,
        incorrectItem: item.incorrectItem,
      })),
    })),
  };
}
