import { z } from 'zod';
import type { Pagination } from '@worknoon/shared-types';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/constants';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export function buildPagination(page: number, limit: number, total: number): Pagination {
  return { page, limit, total, pages: total === 0 ? 0 : Math.ceil(total / limit) };
}
