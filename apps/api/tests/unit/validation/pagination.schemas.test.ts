import { describe, expect, it } from 'vitest';
import { buildPagination, paginationQuerySchema } from '../../../src/validation/pagination.schemas';

describe('paginationQuerySchema', () => {
  it('defaults to page 1 with 25 items', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 25 });
  });

  it('rejects page 0 and a negative limit', () => {
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ limit: '-5' }).success).toBe(false);
  });

  it('rejects a non-numeric page', () => {
    expect(paginationQuerySchema.safeParse({ page: 'first' }).success).toBe(false);
  });
});

describe('buildPagination', () => {
  it('computes the number of pages', () => {
    expect(buildPagination(1, 25, 51)).toEqual({ page: 1, limit: 25, total: 51, pages: 3 });
  });

  it('reports zero pages for an empty result', () => {
    expect(buildPagination(1, 25, 0)).toEqual({ page: 1, limit: 25, total: 0, pages: 0 });
  });
});
