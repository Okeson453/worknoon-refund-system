import { formatDateTime } from '../../utils/formatDate';
import type { AuditEventDto } from '../../types/refund';

const ACTOR_CLASS: Record<string, string> = {
  CUSTOMER: '',
  AI: 'timeline__dot--ai',
  POLICY_ENGINE: 'timeline__dot--policy',
  SYSTEM: 'timeline__dot--system',
  ADMIN: 'timeline__dot--system',
};

function toPrettyJson(payload: Record<string, unknown> | null): string {
  if (payload === null) return '';
  return JSON.stringify(payload, null, 2);
}

/** Ordered, immutable record of every transition of the request. */
export function AuditTimeline({ events }: { events: AuditEventDto[] }): JSX.Element {
  if (events.length === 0) {
    return <p className="inline-note">No audit events recorded for this request.</p>;
  }

  return (
    <ol className="timeline">
      {events.map((event) => {
        const json = toPrettyJson(event.payload);
        return (
          <li key={event.id} className="timeline__item">
            <span className={`timeline__dot ${ACTOR_CLASS[event.actor] ?? ''}`} aria-hidden="true" />
            <div className="timeline__content">
              <div className="timeline__head">
                <span className="timeline__type">{event.eventType}</span>
                <span className="timeline__time">
                  {event.actor} · {formatDateTime(event.createdAt)}
                </span>
              </div>
              <p className="timeline__summary">{event.summary}</p>
              {json.length > 0 ? (
                <details className="payload-details">
                  <summary>Payload</summary>
                  <pre>{json}</pre>
                </details>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
