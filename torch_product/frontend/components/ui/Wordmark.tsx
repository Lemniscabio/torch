import Link from 'next/link';

// The product wordmark. No icon, no brand accent; the app shell stays
// deliberately monochrome while marketing can keep its own palette.
export function Wordmark({ href = '/dashboard' }: { href?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-baseline gap-1.5"
      aria-label="Torch — go to dashboard"
    >
      <span
        className="text-[18px] font-semibold tracking-[-0.02em]"
        style={{ color: 'var(--color-ink-900)' }}
      >
        torch
      </span>
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full transition-transform duration-150 group-hover:scale-125"
        style={{ background: 'var(--color-ink-500)' }}
      />
    </Link>
  );
}
