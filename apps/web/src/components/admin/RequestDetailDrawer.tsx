import { useEffect, useRef, useState } from 'react';
import { Card } from '../common/Card';
import { Spinner } from '../common/Spinner';
import { ErrorState } from '../common/ErrorState';
import { RefundStatusBadge } from '../refund/RefundStatus';
import { SuspiciousBadge } from './SuspiciousBadge';
import { PolicyChecks } from './PolicyChecks';
import { AIAnalysis } from './AIAnalysis';
import { AuditTimeline } from './AuditTimeline';
import { getRefundRequest } from '../../services/refunds';
import { ApiRequestError } from '../../services/api';
import { formatCurrency, formatCurrencyExact } from '../../utils/formatCurrency';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import { ORDER_STATUS_META, reasonCodeLabel, refundReasonLabel } from '../../utils/status';
import type { RefundRequestDetail } from '../../types/refund';

export interface RequestDetailDrawerProps {
  requestId: string | null;
  onClose: () => void;
}

export function RequestDetailDrawer({ requestId, onClose }: RequestDetailDrawerProps): JSX.Element | null {
  const [detail, setDetail] = useState<RefundRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId: string | null } | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (requestId === null) {
      setDetail(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    getRefundRequest(requestId, controller.signal)
      .then((response) => setDetail(response))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError({
          message: cause instanceof ApiRequestError ? cause.message : 'Could not load this refund request.',
          requestId: cause instanceof ApiRequestError ? cause.requestId : null,
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [requestId]);

  useEffect(() => {
    if (requestId === null) return;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestId, onClose]);

  if (requestId === null) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer__header">
          <div>
            <h2 className="drawer__title" id="drawer-title">
              {detail === null ? 'Refund request' : `RF-${String(detail.displayId).padStart(4, '0')}`}
            </h2>
            <p className="card__hint">
              {detail === null ? 'Loading decision trail…' : `${detail.customer.name} · ${detail.order.id} · ${formatDateTime(detail.createdAt)}`}
            </p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} ref={closeRef} aria-label="Close request details">
            ✕
          </button>
        </header>

        <div className="drawer__body">
          {isLoading ? (
            <div className="state-block" role="status">
              <Spinner size="lg" label="Loading request" />
            </div>
          ) : null}

          {!isLoading && error !== null ? <ErrorState message={error.message} requestId={error.requestId} onRetry={onClose} /> : null}

          {!isLoading && error === null && detail === null ? (
            <p className="inline-note">This refund request is no longer available.</p>
          ) : null}

          {detail !== null ? (
            <>
              <Card title="Overview" headingLevel={3}>
                <div className="decision-banner">
                  <RefundStatusBadge status={detail.status} />
                  <SuspiciousBadge suspicious={detail.policyResult?.rules.some((rule) => rule.id === 'E1' && rule.fired) ?? false} aiUsed={detail.aiUsed} />
                  <span className="inline-note" style={{ marginLeft: 'auto' }}>
                    Trusted amount {formatCurrencyExact(detail.refundAmountCents)}
                  </span>
                </div>

                <div className="detail-grid" style={{ marginTop: 16 }}>
                  <div className="detail-grid__item">
                    <span className="detail-grid__label">Customer</span>
                    <span className="detail-grid__value">{detail.customer.name}</span>
                  </div>
                  <div className="detail-grid__item">
                    <span className="detail-grid__label">Email</span>
                    <span className="detail-grid__value">{detail.customer.email}</span>
                  </div>
                  <div className="detail-grid__item">
                    <span className="detail-grid__label">Order</span>
                    <span className="detail-grid__value">{detail.order.id}</span>
                  </div>
                  <div className="detail-grid__item">
                    <span className="detail-grid__label">Order status</span>
                    <span className="detail-grid__value">
                      {ORDER_STATUS_META[detail.order.status].label} · {formatDate(detail.order.orderDate)}
                    </span>
                  </div>
                  <div className="detail-grid__item">
                    <span className="detail-grid__label">Detected reason</span>
                    <span className="detail-grid__value">{refundReasonLabel(detail.detectedReason)}</span>
                  </div>
                  <div className="detail-grid__item">
                    <span className="detail-grid__label">Order total</span>
                    <span className="detail-grid__value">{formatCurrency(detail.order.totalCents)}</span>
                  </div>
                </div>

                <p className="form-field__label" style={{ marginTop: 16 }}>
                  Items requested
                </p>
                <ul className="selection-list">
                  {detail.items.map((item) => (
                    <li key={item.id} className="selection-option" style={{ cursor: 'default' }}>
                      <span className="selection-option__body">
                        <span className="selection-option__title">
                          {item.productName} · {formatCurrency(item.priceCents * item.quantity)}
                        </span>
                        <span className="selection-option__meta">
                          {item.finalSale ? 'Final sale · ' : ''}
                          {item.damaged ? 'Damage on record · ' : ''}
                          {item.incorrectItem ? 'Wrong item on record' : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="form-field__label" style={{ marginTop: 16 }}>
                  Customer message
                </p>
                <p className="quote-block">{detail.customerMessage}</p>

                <p className="form-field__label" style={{ marginTop: 16 }}>
                  Customer reply
                </p>
                <p className="quote-block">{detail.customerResponse ?? '—'}</p>
              </Card>

              <Card title="Policy checks" hint="Every rule the deterministic engine evaluated" headingLevel={3}>
                {detail.policyResult === null ? (
                  <p className="inline-note">The request was never decided.</p>
                ) : (
                  <>
                    <p className="inline-note" style={{ marginBottom: 12 }}>
                      Verdict <strong>{detail.policyResult.decision}</strong> · reason codes{' '}
                      {detail.policyResult.reasonCodes.length > 0
                        ? detail.policyResult.reasonCodes.map((code) => reasonCodeLabel(code)).join(', ')
                        : 'none'}
                    </p>
                    <PolicyChecks rules={detail.policyResult.rules} />
                  </>
                )}
              </Card>

              <Card title="AI analysis" hint="Signals only — never the decision" headingLevel={3}>
                <AIAnalysis interpretation={detail.aiInterpretation} aiUsed={detail.aiUsed} audit={detail.audit} />
              </Card>

              <Card title="Audit timeline" headingLevel={3}>
                <AuditTimeline events={detail.audit} />
              </Card>
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}
