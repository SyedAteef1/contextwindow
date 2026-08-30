"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The gap between connecting a calendar and the first meeting appearing.
 *
 * A sync starts the moment onboarding finishes, and the scheduler polls every
 * five minutes after that — so there is nothing for a rep to press. The old
 * empty state offered a "Check calendar now" button anyway, which quietly
 * implied the opposite: that nothing happens unless you ask.
 *
 * So this says what is happening and refreshes itself until it is. It gives up
 * after two minutes rather than polling forever, because by then the answer is
 * genuinely "you have no external calls coming up", and a spinner that never
 * resolves is worse than an honest empty screen.
 */
export function AwaitingFirstSync({ domain }: { domain: string }) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.round((Date.now() - started) / 1000);
      setElapsed(seconds);
      // Server components re-run on refresh, so a meeting that landed since the
      // page rendered simply appears.
      if (seconds < 120) router.refresh();
      else clearInterval(timer);
    }, 6000);
    return () => clearInterval(timer);
  }, [router]);

  const givenUp = elapsed >= 120;

  return (
    <div className="rounded-lg border border-rule bg-surface px-5 py-4">
      <div className="flex items-center gap-2.5">
        {!givenUp && (
          <span className="pulse-live size-1.5 shrink-0 rounded-full bg-cobalt" aria-hidden />
        )}
        <p className="text-[13.5px] font-medium text-ink">
          {givenUp ? "No external calls on your calendar yet" : "Reading your calendar…"}
        </p>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {givenUp ? (
          <>
            We look {" "}
            <span className="text-ink-soft">two weeks ahead</span> for meetings with someone
            outside {domain}. Book one and it will appear here on its own — we check every few
            minutes.
          </>
        ) : (
          <>
            Looking two weeks ahead for meetings with someone outside {domain}. This happens on
            its own from now on; you never have to press anything.
          </>
        )}
      </p>
    </div>
  );
}
