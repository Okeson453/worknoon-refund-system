import type { PolicyInput, PolicyItemFact, PolicySignals } from '../../src/policy/policy.types';
import { DEFAULT_POLICY_CONFIG } from '../../src/policy/policy.constants';

export const NOW = new Date('2026-09-28T12:00:00.000Z');

export function daysBefore(days: number, from: Date = NOW): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

export function makeItem(overrides: Partial<PolicyItemFact> = {}): PolicyItemFact {
  return {
    id: 'ITM-TEST-1',
    name: 'Test Product',
    priceCents: 10_000,
    quantity: 1,
    finalSale: false,
    damaged: false,
    incorrectItem: false,
    previouslyRefunded: false,
    ...overrides,
  };
}

export function makeSignals(overrides: Partial<PolicySignals> = {}): PolicySignals {
  return {
    reason: 'DAMAGED',
    confidence: 0.95,
    claimedAmountCents: null,
    suspicious: false,
    aiFailed: false,
    identifiedItemIds: ['ITM-TEST-1'],
    ...overrides,
  };
}

export function makeInput(overrides: Partial<PolicyInput> = {}): PolicyInput {
  const { items = [makeItem()], signals = makeSignals(), ...rest } = overrides;
  return {
    now: NOW,
    order: { status: 'DELIVERED', orderDate: daysBefore(5) },
    items,
    totalItemCount: items.length,
    signals,
    config: { ...DEFAULT_POLICY_CONFIG },
    ...rest,
  };
}

/** Slightly unfortunate named product so E1 can never be triggered by test data. */
export const CLEAN_MESSAGE = 'The order arrived on time and everything looked fine.';
