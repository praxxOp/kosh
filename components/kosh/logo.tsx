/** Minimal monochrome mark: a rounded square in the current text colour with a K cut out of it. */
export function KoshMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <path d="M23 18v28M23 33l16-15M25 33l16 13" stroke="var(--background)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
