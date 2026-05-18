'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import Link, { type LinkProps } from 'next/link';

type Variant = 'primary' | 'ghost' | 'flame';
type Size = 'sm' | 'md';

type BaseProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

function classes({ variant = 'primary', size = 'md', fullWidth }: BaseProps) {
  const base = 'btn';
  const variantClass =
    variant === 'primary' ? 'btn-primary' : variant === 'flame' ? 'btn-flame' : 'btn-ghost';
  const sizeClass = size === 'sm' ? 'h-8 px-3 text-[13px]' : '';
  const widthClass = fullWidth ? 'w-full' : '';
  return [base, variantClass, sizeClass, widthClass].filter(Boolean).join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, fullWidth, className = '', disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${classes({ variant, size, fullWidth })} ${className}`}
      {...rest}
    >
      {loading ? <span className="opacity-70">Working…</span> : children}
    </button>
  );
});

// Anchor variant — same chrome, renders <a> or Next <Link>.
type LinkButtonProps = BaseProps &
  Omit<LinkProps, 'as'> & {
    children: React.ReactNode;
    className?: string;
  };

export function LinkButton({
  variant,
  size,
  fullWidth,
  className = '',
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={`${classes({ variant, size, fullWidth })} ${className}`} {...rest}>
      {children}
    </Link>
  );
}
