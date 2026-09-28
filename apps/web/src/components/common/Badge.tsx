import type { ReactNode } from 'react';
import type { Tone } from '../../utils/status';

export interface BadgeProps {
  tone?: Tone;
  glyph?: string;
  children: ReactNode;
  title?: string;
}

export function Badge({ tone = 'neutral', glyph, children, title }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {glyph ? (
        <span className="badge__glyph" aria-hidden="true">
          {glyph}
        </span>
      ) : null}
      {children}
    </span>
  );
}
