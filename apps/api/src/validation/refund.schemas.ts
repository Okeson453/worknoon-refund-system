import { z } from 'zod';
import { MAX_ITEM_IDS_PER_REQUEST, MESSAGE_MAX_LENGTH, MESSAGE_MIN_LENGTH } from '../config/constants';
import { REFUND_STATUSES } from '@worknoon/shared-types';
import { identifierSchema } from './common.schemas';
import { paginationQuerySchema } from './pagination.schemas';

export const createRefundRequestSchema = z
  .object({
    customerId: identifierSchema,
    orderId: identifierSchema,
    itemIds: z
      .array(identifierSchema)
      .min(1, 'Select at least one item.')
      .max(MAX_ITEM_IDS_PER_REQUEST, `At most ${MAX_ITEM_IDS_PER_REQUEST} items can be requested in one refund.`),
    message: z
      .string({ required_error: 'A message is required.' })
      .trim()
      .min(MESSAGE_MIN_LENGTH, 'A message is required.')
      .max(MESSAGE_MAX_LENGTH, `Message must be at most ${MESSAGE_MAX_LENGTH} characters.`),
  })
  .strict();

export type CreateRefundRequestPayload = z.infer<typeof createRefundRequestSchema>;

export const listRefundRequestsQuerySchema = paginationQuerySchema.extend({
  decision: z.enum(REFUND_STATUSES).optional(),
});

export type ListRefundRequestsQuery = z.infer<typeof listRefundRequestsQuerySchema>;
