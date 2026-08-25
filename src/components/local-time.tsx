"use client";

import { useCallback, useSyncExternalStore } from "react";

import { dateTime } from "@/lib/format";

/** Nothing to subscribe to — the value only differs between server and client. */
const noopSubscribe = () => () => {};

/**
 * A timestamp shown in the reader's own timezone.
 *
 * The server renders in its timezone (UTC in production) and the browser in the
 * rep's. That difference is intentional, so it goes through
 * `useSyncExternalStore`, which is the supported way to hand SSR and the client
 * different snapshots — rather than a `useState` + `useEffect` pair, which
 * would trigger a cascading render on every timestamp on the page.
 *
 * The locale is pinned in `format.ts`, so only the timezone can vary.
 */
export function LocalTime({
  value,
  className,
}: {
  value: string | Date;
  className?: string;
}) {
  const iso = typeof value === "string" ? value : value.toISOString();

  const getClientSnapshot = useCallback(() => dateTime(iso), [iso]);
  const getServerSnapshot = useCallback(
    () => dateTime(new Date(iso).toISOString()),
    [iso],
  );

  const text = useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
