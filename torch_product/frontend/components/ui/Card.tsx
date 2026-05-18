import type { ReactNode } from 'react';

// Plain bordered surface. No drop shadow. Used sparingly — most places
// should use hairline rules instead. Reach for Card when the content needs
// to feel portable (a self-contained domain card the user might copy to
// a deck or screenshot).
export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'aside';
}) {
  return (
    <Tag
      className={`rounded-lg border bg-[color:var(--color-paper-50)] ${className}`}
      style={{ borderColor: 'var(--color-rule-strong)' }}
    >
      {children}
    </Tag>
  );
}
