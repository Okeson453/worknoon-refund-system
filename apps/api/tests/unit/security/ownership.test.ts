import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOrderForCustomer, listOrdersForCustomer } from '../../../src/database/repositories/order.repository';

const { findFirst, findMany } = vi.hoisted(() => ({ findFirst: vi.fn(), findMany: vi.fn() }));

vi.mock('../../../src/database/prisma', () => ({
  prisma: {
    order: { findFirst, findMany },
    customer: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

describe('order ownership', () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
  });

  it('scopes the lookup to the customer id', async () => {
    findFirst.mockResolvedValue(null);
    await findOrderForCustomer('CUST-002', 'ORD-1001');

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: 'ORD-1001', customerId: 'CUST-002' });
  });

  it('returns null for an order owned by someone else', async () => {
    findFirst.mockResolvedValue(null);
    await expect(findOrderForCustomer('CUST-002', 'ORD-1001')).resolves.toBeNull();
  });

  it('never returns items of a foreign order', async () => {
    findFirst.mockResolvedValue(null);
    const result = await findOrderForCustomer('CUST-013', 'ORD-1001');
    expect(result).toBeNull();
  });

  it('lists orders by customer id only', async () => {
    findMany.mockResolvedValue([]);
    await listOrdersForCustomer('CUST-010');
    expect(findMany.mock.calls[0][0].where).toEqual({ customerId: 'CUST-010' });
  });
});
