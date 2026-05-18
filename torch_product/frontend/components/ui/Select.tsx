'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

// Native select — styled to match Input. We could ship a custom listbox
// later, but the native control is keyboard-accessible by default and feels
// quieter (no rendered popover that has to be designed). Use only when the
// option list is short and labeled.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className = '', children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`field appearance-none pr-9 ${className}`}
        {...rest}
      >
        {children}
      </select>
      {/* caret */}
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2"
        style={{ color: 'var(--color-ink-500)' }}
      >
        <path
          d="M2 4.5 L6 8.5 L10 4.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
});
