import Link from 'next/link';

// The product wordmark. No icon — just typography. The flame accent appears
// only on the dot under the "i" in "torch", which is the single piece of
// product branding inside the app (marketing uses different chrome).
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
        style={{ background: 'var(--color-flame-500)' }}
      />
    </Link>
  );
}
