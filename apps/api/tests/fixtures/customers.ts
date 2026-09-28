import type { CustomerSummary } from '@worknoon/shared-types';

/** The seeded demo customers, in the order the switcher shows them. */
export const EXPECTED_CUSTOMERS: CustomerSummary[] = [
  { id: 'CUST-001', name: 'Amara Osei', email: 'customer001@example.test' },
  { id: 'CUST-002', name: 'Bruno Almeida', email: 'customer002@example.test' },
  { id: 'CUST-003', name: 'Chen Wei', email: 'customer003@example.test' },
  { id: 'CUST-004', name: 'Dana Kowalski', email: 'customer004@example.test' },
  { id: 'CUST-005', name: 'Elena Rossi', email: 'customer005@example.test' },
  { id: 'CUST-006', name: 'Farid Haddad', email: 'customer006@example.test' },
  { id: 'CUST-007', name: 'Grace Lindqvist', email: 'customer007@example.test' },
  { id: 'CUST-008', name: 'Hiro Tanaka', email: 'customer008@example.test' },
  { id: 'CUST-009', name: 'Ines Ferreira', email: 'customer009@example.test' },
  { id: 'CUST-010', name: 'Jonas Berg', email: 'customer010@example.test' },
  { id: 'CUST-011', name: 'Kavya Iyer', email: 'customer011@example.test' },
  { id: 'CUST-012', name: 'Lucas Moreau', email: 'customer012@example.test' },
  { id: 'CUST-013', name: 'Maya Haddad', email: 'customer013@example.test' },
  { id: 'CUST-014', name: 'Noah Bennett', email: 'customer014@example.test' },
  { id: 'CUST-015', name: 'Olivia Novak', email: 'customer015@example.test' },
];

export const DEMO_CUSTOMER_COUNT = EXPECTED_CUSTOMERS.length;

export function customerById(id: string): CustomerSummary {
  const found = EXPECTED_CUSTOMERS.find((customer) => customer.id === id);
  if (found === undefined) throw new Error(`Unknown fixture customer ${id}`);
  return found;
}
