import type { ReactNode } from 'react';

export interface CardProps {
  title?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
  headingLevel?: 2 | 3;
}

export function Card({ title, hint, actions, children, bodyClassName, className, headingLevel = 2 }: CardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const hasHeader = title !== undefined || actions !== undefined;

  return (
    <section className={['card', className].filter(Boolean).join(' ')}>
      {hasHeader ? (
        <header className="card__header">
          <div>
            <Heading className="card__title">{title}</Heading>
            {hint ? <p className="card__hint">{hint}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className={bodyClassName ?? 'card__body'}>{children}</div>
    </section>
  );
}
