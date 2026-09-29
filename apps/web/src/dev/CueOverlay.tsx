import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { useDevSession } from './SessionContext';
import { CUES } from './cues';
import { formatCurrencyExact } from '../utils/formatCurrency';

/**
 * Presenter overlay for the recorded walkthrough. Dev-only.
 *
 * Three things the plain app does not give you on camera:
 *   1. A verdict chip pinned bottom-right that mirrors the API response, so the verdict, the amount
 *      and the safety refusal are legible at 1080p instead of being a small badge below the fold.
 *   2. A mirror of every toast, so the "Refund request escalated" notification is inside the frame
 *      rather than cropped off its right edge.
 *   3. A script cue card with the next beat while you are talking.
 *
 * Keys:  n / p = next / previous cue   h = hide or show the overlay   r = reset the verdict chip
 */
export function CueOverlay(): JSX.Element | null {
  const session = useDevSession();
  const [cueIndex, setCueIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [showScript, setShowScript] = useState(true);
  // Verdict chip is cleared by pressing "r"; it reappears when the next decision lands. Advancing the
  // cue card resets it too, because each beat ends with a fresh submission anyway.
  const [clearedAt, setClearedAt] = useState(0);

  const telemetry = session?.telemetry ?? null;
  const toasts = session?.toasts ?? [];
  const submissionCount = telemetry?.submissionCount ?? 0;

  const step = useCallback((delta: number) => {
    setCueIndex((current) => {
      setClearedAt(submissionCount);
      return Math.min(Math.max(current + delta, 0), CUES.length - 1);
    });
  }, [submissionCount]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent | globalThis.KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      // Never steal keys while the presenter is typing an actual refund message.
      if (target !== null && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === 'n') step(1);
      else if (key === 'p') step(-1);
      else if (key === 'h') setVisible((current) => !current);
      else if (key === 's') setShowScript((current) => !current);
      else if (key === 'r') {
        setClearedAt(submissionCount);
        session?.refresh();
      }
    };
    window.addEventListener('keydown', onKeyDown as (event: globalThis.KeyboardEvent) => void);
    return () => window.removeEventListener('keydown', onKeyDown as (event: globalThis.KeyboardEvent) => void);
  }, [step, session, submissionCount]);

  if (!visible) {
    return <div className="dev-cue__hint">overlay hidden — h to show</div>;
  }

  const cue = CUES[cueIndex] ?? CUES[0];
  // A decision is only "current" if it landed since this cue was opened.
  const decision = telemetry !== null && submissionCount > clearedAt ? telemetry : null;
  // PENDING never reaches this component through the customer flow, but guard anyway so the chip
  // cannot claim a verdict the API has not issued.
  const settled = decision !== null && decision.decision !== null && decision.decision !== 'PENDING';
  const showVerdict = decision !== null && (settled || decision.blocked);

  return (
    <div className="dev-cue-root">
      {showScript ? (
        <aside className="dev-cue" aria-label="Presenter script">
          <p className="dev-cue__eyebrow">Presenter overlay · dev only</p>
          <p className="dev-cue__time">
            {cue.time} · cue {cueIndex + 1}/{CUES.length}
          </p>
          <h2 className="dev-cue__title">{cue.title}</h2>
          <p className="dev-cue__proves">{cue.proves}</p>
          <p className="dev-cue__say">{cue.say}</p>
          {session !== null && session.context !== '' ? (
            <div className="dev-cue__section">
              <p className="dev-cue__section-title">In the form right now</p>
              <pre className="dev-cue__context">{session.context}</pre>
            </div>
          ) : null}
          {cue.do.length > 0 ? (
            <div className="dev-cue__section">
              <p className="dev-cue__section-title">Do</p>
              <ol className="dev-cue__list">
                {cue.do.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          ) : null}
          <div className="dev-cue__footer">
            <span>n / p cues · s hide script · h hide all · r reset verdict</span>
            <span className="dev-cue__nav">
              <button type="button" onClick={() => step(-1)} disabled={cueIndex === 0}>
                prev
              </button>
              <button type="button" onClick={() => step(1)} disabled={cueIndex === CUES.length - 1}>
                next
              </button>
            </span>
          </div>
        </aside>
      ) : null}

      {showVerdict ? (
        <div
          className={`dev-verdict ${
            decision.blocked ? 'dev-verdict--blocked' : `dev-verdict--${(decision.decision ?? '').toLowerCase()}`
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="dev-verdict__label">
            {decision.blocked ? 'Safety gate' : `API decision · request #${decision.submissionCount}`}
          </p>
          <p className="dev-verdict__decision">
            {decision.blocked ? 'BLOCKED BEFORE DECISION' : decision.decision ?? ''}
          </p>
          {!decision.blocked && settled ? (
            <p className="dev-verdict__meta">
              {decision.amountCents !== null ? formatCurrencyExact(decision.amountCents) : '—'}
              {decision.reference !== null ? ` · ${decision.reference}` : ''}
            </p>
          ) : null}
          {decision.reasons.length > 0 ? (
            <ul className="dev-verdict__reasons">
              {decision.reasons.map((reason) => (
                <li key={reason}>· {reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {showVerdict === false && toasts.length > 0 ? (
        <div className="dev-toast-mirror" aria-hidden="true">
          {toasts.map((toast) => (
            <div key={toast.id} className={`dev-toast-mirror__item dev-toast-mirror__item--${toast.tone}`}>
              <span className="dev-toast-mirror__title">{toast.title}</span>
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
