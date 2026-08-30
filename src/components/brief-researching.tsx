"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Skeleton } from "./skeleton";

/**
 * The brief, while it is still being written.
 *
 * A meeting appears on the rail the moment it is detected, but its research
 * takes twenty to sixty seconds — web search, then a model writing several
 * hundred words. The page used to show "No brief yet" with a button to start
 * one, which is wrong twice: research had already started, and the button
 * invited a rep to trigger a second run of work in flight.
 *
 * So the card is there from the start, shaped like the brief that will replace
 * it, and it refreshes until the real one lands. What a rep learns from this is
 * "it is coming", which is the only true thing to tell them.
 */
export function BriefResearching({ companyName }: { companyName: string }) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.round((Date.now() - started) / 1000);
      setElapsed(seconds);
      // Research is a background job, so nothing pushes to this page. Three
      // minutes of polling covers a slow run; past that it has failed and the
      // page should stop pretending otherwise.
      if (seconds < 180) router.refresh();
      else clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [router]);

  const stalled = elapsed >= 180;

  return (
    <div className="rounded-lg border border-rule bg-surface px-6 py-5">
      <div className="flex flex-wrap items-center gap-2.5">
        {!stalled && (
          <span className="pulse-live size-1.5 shrink-0 rounded-full bg-cobalt" aria-hidden />
        )}
        <p className="text-[13.5px] font-medium text-ink">
          {stalled ? "Research didn't finish" : `Researching ${companyName}…`}
        </p>
        {!stalled && (
          <span className="font-mono text-[10.5px] tabular-nums text-faint">{elapsed}s</span>
        )}
      </div>

      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {stalled
          ? "Something went wrong on our side. Run it again, and if it fails twice tell us — that is a bug rather than a slow day."
          : "Searching the web and your own material for what can be verified about them, and everyone on the invite."}
      </p>

      {!stalled && (
        // Shaped like the brief that replaces it: a heading, a paragraph, a
        // short list. A placeholder at the wrong shape makes the real thing
        // jump when it lands, which reads as a glitch.
        <div className="mt-6 flex flex-col gap-3 border-t border-rule-soft pt-5" aria-hidden>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-[92%]" />
          <Skeleton className="h-2.5 w-[64%]" />
          <Skeleton className="mt-3 h-3 w-40" />
          <Skeleton className="h-2.5 w-[88%]" />
          <Skeleton className="h-2.5 w-[71%]" />
        </div>
      )}
    </div>
  );
}
