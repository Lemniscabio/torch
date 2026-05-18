'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

type Option = { value: string; label: string; hint?: string };

type RadioGroupProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  options: ReadonlyArray<Option>;
  value?: string;
};

export const RadioGroup = forwardRef<HTMLInputElement, RadioGroupProps>(
  function RadioGroup({ options, value, name, onChange, onBlur }, ref) {
    return (
      <div
        role="radiogroup"
        className="grid gap-2 sm:grid-cols-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))` }}
      >
        {options.map((opt, i) => {
          const id = `${name}-${opt.value}`;
          const selected = value === opt.value;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className="cursor-pointer select-none rounded-lg border px-3 py-2.5 transition-all"
              style={{
                borderColor: selected
                  ? 'rgba(255,255,255,0.25)'
                  : 'var(--color-ink-200)',
                background: selected
                  ? 'rgba(255,255,255,0.1)'
                  : 'var(--color-paper-200)',
                color: selected ? 'var(--color-ink-900)' : 'var(--color-ink-700)',
                boxShadow: selected
                  ? '0 0 0 1px rgba(255,255,255,0.12) inset'
                  : 'none',
              }}
            >
              <input
                ref={i === 0 ? ref : undefined}
                id={id}
                name={name}
                type="radio"
                value={opt.value}
                checked={selected}
                onChange={onChange}
                onBlur={onBlur}
                className="sr-only"
              />
              <span className="block text-[14px] font-medium leading-snug">{opt.label}</span>
              {opt.hint ? (
                <span
                  className="mt-0.5 block text-[12px]"
                  style={{ color: selected ? 'var(--color-ink-500)' : 'var(--color-ink-400)' }}
                >
                  {opt.hint}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    );
  },
);
