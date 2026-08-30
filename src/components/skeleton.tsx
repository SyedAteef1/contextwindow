import { cn } from "@/lib/cn";

/**
 * A placeholder for something that has not arrived.
 *
 * Every page here is `force-dynamic` and queries Postgres, so a navigation has
 * real latency — and until now it spent that latency showing the previous page,
 * frozen, with no sign the click registered. A skeleton is not decoration in
 * that situation: it is the only feedback there is.
 *
 * The rule these follow is that a placeholder mirrors the *shape* of what
 * replaces it. Bars at the wrong width or count make the real content jump when
 * it lands, which reads as a glitch and is worse than having shown nothing.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("shimmer rounded bg-rule/70", className)} />
  );
}

/** A heading, a line of meta, and a rule — the top of every page here. */
export function HeadSkeleton() {
  return (
    <div className="mb-8 border-b border-rule pb-7">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3.5 h-7 w-64" />
      <Skeleton className="mt-3 h-3 w-52" />
    </div>
  );
}

/**
 * The time rail, waiting.
 *
 * Same spine, same gutter, same node positions as the real one, so when the
 * meetings land they fill the outline rather than replacing it.
 */
export function RailSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rail-dark relative">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={i === rows - 1 ? "relative" : "relative pb-8"}>
          <span className="rail-stamp">
            <Skeleton className="ml-auto h-2.5 w-9" />
          </span>
          <span className="rail-dot" aria-hidden />
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="mt-2 h-2.5 w-40" />
        </div>
      ))}
    </div>
  );
}

/** The left rail of the app, at its real 16rem width so nothing shifts. */
export function SidebarSkeleton() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-rule lg:block">
      <div className="sticky top-[57px] flex max-h-[calc(100dvh-57px)] flex-col gap-5 px-3 py-5">
        <Skeleton className="h-3 w-28" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, group) => (
            <div key={group} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-36" />
              <div className="flex flex-col gap-2 pl-4">
                {Array.from({ length: 2 }).map((_, row) => (
                  <div key={row} className="flex flex-col gap-1.5">
                    <Skeleton className="h-2.5 w-32" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/** A stack of cards, for the account and section views. */
export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-rule bg-surface p-5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3.5 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-[85%]" />
          <Skeleton className="mt-2 h-3 w-[60%]" />
        </div>
      ))}
    </div>
  );
}
