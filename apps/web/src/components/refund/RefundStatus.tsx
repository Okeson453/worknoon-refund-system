import { Badge } from '../common/Badge';
import { refundStatusMeta } from '../../utils/status';
import type { RefundStatus as RefundStatusValue } from '@worknoon/shared-types';

export interface RefundStatusBadgeProps {
  status: RefundStatusValue | string;
  size?: 'default' | 'large';
}

export function RefundStatusBadge({ status }: RefundStatusBadgeProps): JSX.Element {
  const meta = refundStatusMeta(status);
  return (
    <Badge tone={meta.tone} glyph={meta.glyph} title={meta.description}>
      {meta.label}
    </Badge>
  );
}
