/**
 * The mark.
 *
 * A frame with a filled band inside it: brackets holding content. That is
 * literally what a context window is, and it is the one image the name already
 * gives us — so the logo says the product's name rather than decorating it.
 * Drawn rather than lettered so it holds at 20px in a nav and in a footer.
 */
export function Mark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      {/* The window */}
      <rect
        x="1.4"
        y="1.4"
        width="13.2"
        height="13.2"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      {/* What is in it: two lines of context, and the one that answered the
          question. Highlighting a single line is the product's whole job.
          Cobalt, not green: a mark is identity and is the same on a business
          card as on a 404 page, whereas green here means a live state the logo
          is never actually reporting. */}
      <rect x="4.4" y="5.6" width="7.2" height="1.5" rx="0.75" fill="currentColor" opacity="0.4" />
      <rect x="4.4" y="9" width="5.2" height="1.5" rx="0.75" className="fill-cobalt" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Mark className="size-5 text-muted" />
      <span className="text-base font-semibold tracking-tight text-ink">Context Window</span>
    </span>
  );
}
