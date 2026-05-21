import type { ReactNode } from 'react';

// Standard form field wrapper. Renders a label above the input, optional
// hint below, and an error replacement when present. Two-row layout, no
// floating labels, no asterisks — required-ness shown by hint when needed.
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-meta" style={{ color: 'var(--color-ink-700)' }}>
        {label}
      </label>
      {children}
      {error ? (
        <p
          role="alert"
          className="text-meta"
          style={{ color: 'var(--color-danger-fg)' }}
        >
          {error}
        </p>
      ) : hint ? (
        <div className="text-meta">{hint}</div>
      ) : null}
    </div>
  );
}
