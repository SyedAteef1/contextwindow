"use client";

import { useEffect, useRef } from "react";

/**
 * Clears the "new brief" indicator once the rep has actually opened the brief.
 *
 * Renders nothing. Fires at most once per mount — React runs effects twice in
 * development, and a double POST would be harmless but pointless.
 */
export function MarkBriefSeen({ meetingId }: { meetingId: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    // Best effort: failing to record a read receipt must not disturb the page.
    void fetch(`/api/meetings/${meetingId}/brief/seen`, { method: "POST" }).catch(() => {});
  }, [meetingId]);

  return null;
}
