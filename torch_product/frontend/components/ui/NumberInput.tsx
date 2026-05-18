'use client';

// Wraps <Input type="number"> with a trailing unit label inside the field.
// Keeps tabular-num formatting consistent with the rest of the surface.

import { forwardRef, type InputHTMLAttributes } from 'react';

type NumberInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  unit?: string;
};

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput({ invalid, unit, className = '', ...rest }, ref) {
    return (
      <div className="relative">
        <input
          ref={ref}
          inputMode="decimal"
          type="number"
          step="any"
          aria-invalid={invalid || undefined}
          className={`field font-[var(--font-mono)] ${unit ? 'pr-14' : ''} ${className}`}
          style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
          {...rest}
        />
        {unit ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px]"
            style={{ color: 'var(--color-ink-500)' }}
          >
            {unit}
          </span>
        ) : null}
      </div>
    );
  },
);
