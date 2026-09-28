import { prisma } from '../prisma';

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

const customerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
} as const;

export async function listCustomers(): Promise<CustomerRecord[]> {
  return prisma.customer.findMany({ select: customerSelect, orderBy: { id: 'asc' } });
}

export async function findCustomerById(id: string): Promise<CustomerRecord | null> {
  return prisma.customer.findUnique({ where: { id }, select: customerSelect });
}
