"use client";

import { useEffect } from "react";

/**
 * Tell the server which timezone the reader is in.
 *
 * Renders nothing. The server needs this to group calls by the right day and to
 * say "tomorrow" in an email and mean the reader's tomorrow — it runs in UTC
 * and cannot infer it. Posts only when the browser disagrees with what is
 * stored, so it is one request on first sign-in and none afterwards.
 */
export function TimezoneSync({ current }: { current: string | null }) {
  useEffect(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browser || browser === current) return;

    fetch("/api/me/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: browser }),
      // Nothing on the page waits for this, and a failure is not worth
      // reporting: the next page load tries again.
    }).catch(() => {});
  }, [current]);

  return null;
}
