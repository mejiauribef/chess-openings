import type { PropsWithChildren, ReactNode } from 'react';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  eyebrow?: ReactNode;
}

export function SectionCard({ title, eyebrow, children }: SectionCardProps) {
  return (
    <section className="section-card">
      <header className="section-card__header">
        <div>
          {eyebrow ? <div className="section-card__eyebrow">{eyebrow}</div> : null}
          <h2>{title}</h2>
        </div>
      </header>
      <div className="section-card__body">{children}</div>
    </section>
  );
}

