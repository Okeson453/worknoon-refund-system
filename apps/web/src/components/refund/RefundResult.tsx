import { RefundStatusBadge } from './RefundStatus';
import { formatCurrencyExact } from '../../utils/formatCurrency';
import { reasonCodeLabel } from '../../utils/status';
import type { CreateRefundResponse } from '../../types/refund';

export interface RefundResultProps {
  result: CreateRefundResponse;
}

/** Customer-safe outcome: decision, amount and the reply the customer will receive. */
export function RefundResult({ result }: RefundResultProps): JSX.Element {
  return (
    <section className="refund-result" aria-labelledby="refund-result-title">
      <div className="refund-result__header">
        <div>
          <p className="refund-result__label" id="refund-result-title">
            Decision
          </p>
          <p className="refund-result__amount">{formatCurrencyExact(result.refundAmountCents)}</p>
        </div>
        <RefundStatusBadge status={result.decision} />
      </div>

      <div className={`decision-banner decision-banner--${toneFor(result.decision)}`}>
        <span aria-hidden="true">{glyphFor(result.decision)}</span>
        <p className="decision-banner__text">{result.customerMessage}</p>
      </div>

      <div>
        <p className="refund-result__label">Why</p>
        <ul className="refund-result__reasons">
          {result.reasonCodes.map((code) => (
            <li key={code} className="refund-result__reason">
              {reasonCodeLabel(code)}
            </li>
          ))}
        </ul>
      </div>

      <p className="inline-note">
        Reference {result.id} · decided {new Date(result.createdAt).toLocaleString('en-GB')}
      </p>
    </section>
  );
}

function toneFor(decision: string): string {
  switch (decision) {
    case 'APPROVED':
      return 'positive';
    case 'DENIED':
      return 'negative';
    default:
      return 'caution';
  }
}

function glyphFor(decision: string): string {
  switch (decision) {
    case 'APPROVED':
      return '✓';
    case 'DENIED':
      return '✕';
    default:
      return '!';
  }
}
