import { CATEGORY_TONE, reasonCodeLabel } from '../../utils/status';
import { Badge } from '../common/Badge';
import type { PolicyCheckDto } from '../../types/refund';

/** Every rule the engine evaluated, including the ones that did not fire. */
export function PolicyChecks({ rules }: { rules: PolicyCheckDto[] }): JSX.Element {
  return (
    <div>
      <div className="selection-list" style={{ marginBottom: 12 }}>
        {rules.map((rule) => (
          <div key={rule.id} className="check-row">
            <span
              className={rule.fired ? 'check-row__icon check-row__icon--fired' : 'check-row__icon check-row__icon--passed'}
              aria-hidden="true"
            >
              {rule.fired ? '!' : '·'}
            </span>
            <span>
              <span className="check-row__code">
                {rule.id} {rule.code}
              </span>
              <span className="visually-hidden">{rule.fired ? 'fired' : 'passed'}</span>
            </span>
            <span className="check-row__detail">
              {rule.fired ? <Badge tone={CATEGORY_TONE[rule.category]}>{reasonCodeLabel(rule.code)}</Badge> : null}{' '}
              {rule.detail}
            </span>
          </div>
        ))}
      </div>
      <p className="inline-note">Fired rules are marked with “!”. Precedence: denial, then escalation, then approval.</p>
    </div>
  );
}
