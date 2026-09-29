export type {
  AuditEventDto,
  CreateRefundRequestInput,
  CreateRefundResponse,
  InterpretationDto,
  PolicyCheckDto,
  RefundRequestDetail,
  RefundRequestListItem,
  RefundRequestListResponse,
  RefundStatus,
} from '@worknoon/shared-types';

/** Contract limits mirrored from the API so the UI can validate before sending. */
export const MESSAGE_MAX_LENGTH = 1000;
export const MESSAGE_MIN_LENGTH = 1;

/** UI states of the customer submission flow (spec §22). */
export type RefundSubmissionState = 'idle' | 'validating' | 'submitting' | 'success' | 'error';

export interface ChatEntry {
  id: string;
  role: 'customer' | 'system';
  text: string;
  createdAt: string;
}
