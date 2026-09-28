import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { refundReasonLabel } from '../../utils/status';
import type { InterpretationDto } from '../../types/refund';

export interface AIAnalysisProps {
  interpretation: InterpretationDto | null;
  aiUsed: boolean;
  audit: Array<{ eventType: string; payload: Record<string, unknown> | null }>;
}

/** What the model produced, how confident it was, and how long it took. Never a decision. */
export function AIAnalysis({ interpretation, aiUsed, audit }: AIAnalysisProps): JSX.Element {
  const interpretationEvent = audit.find((event) => event.eventType === 'AI_INTERPRETATION');
  const payload = (interpretationEvent?.payload ?? {}) as Record<string, unknown>;
  const latencyMs = typeof payload.latencyMs === 'number' ? payload.latencyMs : null;
  const model = typeof payload.model === 'string' ? payload.model : null;

  if (!aiUsed || interpretation === null) {
    return (
      <EmptyState
        icon="↺"
        title="No AI interpretation for this request"
        description="The provider was unavailable or returned output that failed validation. The policy engine decided without AI signals."
      />
    );
  }

  return (
    <div className="detail-grid">
      <div className="detail-grid__item">
        <span className="detail-grid__label">Intent</span>
        <span className="detail-grid__value">{interpretation.intent.replace(/_/g, ' ')}</span>
      </div>
      <div className="detail-grid__item">
        <span className="detail-grid__label">Reason</span>
        <span className="detail-grid__value">{refundReasonLabel(interpretation.reason)}</span>
      </div>
      <div className="detail-grid__item">
        <span className="detail-grid__label">Confidence</span>
        <span className="detail-grid__value">{interpretation.confidence.toFixed(2)}</span>
      </div>
      <div className="detail-grid__item">
        <span className="detail-grid__label">Claimed amount</span>
        <span className="detail-grid__value">
          {interpretation.claimedAmountCents === null ? 'Not stated' : `$${(interpretation.claimedAmountCents / 100).toFixed(2)}`}
        </span>
      </div>
      <div className="detail-grid__item">
        <span className="detail-grid__label">Matched items</span>
        <span className="detail-grid__value">
          {interpretation.matchedItemIds.length > 0 ? interpretation.matchedItemIds.join(', ') : 'None identified'}
        </span>
      </div>
      <div className="detail-grid__item">
        <span className="detail-grid__label">Model</span>
        <span className="detail-grid__value">{model ?? 'unknown'}</span>
      </div>
      <div className="detail-grid__item">
        <span className="detail-grid__label">Latency</span>
        <span className="detail-grid__value">{latencyMs === null ? '—' : `${latencyMs} ms`}</span>
      </div>
      <div className="detail-grid__item">
        <span className="detail-grid__label">Injection</span>
        <span className="detail-grid__value">
          {interpretation.injectionSuspected ? <Badge tone="caution">Flagged</Badge> : <Badge tone="positive">None</Badge>}
        </span>
      </div>
      <div className="detail-grid__item" style={{ gridColumn: '1 / -1' }}>
        <span className="detail-grid__label">Summary (audit only)</span>
        <p className="quote-block">{interpretation.summary}</p>
      </div>
    </div>
  );
}
