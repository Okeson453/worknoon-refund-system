import { Badge } from '../common/Badge';

export interface SuspiciousBadgeProps {
  suspicious: boolean;
  aiUsed?: boolean;
}

/** At-a-glance signal so support can spot manipulation attempts in the request list. */
export function SuspiciousBadge({ suspicious, aiUsed }: SuspiciousBadgeProps): JSX.Element | null {
  if (suspicious) {
    return (
      <Badge tone="caution" glyph="⚠" title="Prompt-injection heuristics matched on this request">
        Flagged
      </Badge>
    );
  }
  if (aiUsed === false) {
    return (
      <Badge tone="info" glyph="↺" title="The AI interpretation was unavailable for this request">
        No AI
      </Badge>
    );
  }
  return null;
}
