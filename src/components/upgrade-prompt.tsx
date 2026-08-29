import Link from "next/link";

import { Eyebrow } from "@/components/ui";

/**
 * The moment the free plan runs out of usefulness.
 *
 * Shown on a meeting the research covered but the bot is not attending. The
 * timing is the whole point: this appears next to a finished brief, days
 * before a call the rep is about to walk into alone — which is when wanting a
 * notetaker in the room is a feeling rather than a pitch.
 *
 * Cobalt rather than amber or emerald. Nothing has gone wrong — the free plan
 * did exactly what it promises — so amber would read as a failure. And this is
 * a commercial offer rather than the product doing its trick, so it is not
 * emerald either: green is kept for an answer landing or a deal won.
 */
export function UpgradePrompt({
  companyName,
  when,
}: {
  companyName?: string | null;
  when?: string | null;
}) {
  return (
    <div className="rounded-lg border border-cobalt/35 bg-cobalt/[0.06] px-5 py-4">
      <Eyebrow>Your plan</Eyebrow>
      <p className="mt-1.5 text-[13.5px] text-ink-soft">
        The brief is done. The notetaker is not joining
        {companyName ? ` ${companyName}` : " this call"}
        {when ? ` ${when}` : ""} — that is the part Pro adds: a bot in the room, answers on your
        screen while the buyer is still talking, and the follow-up drafted before you close the
        tab.
      </p>
      <Link
        href="/#pricing"
        className="mt-3.5 inline-flex items-center rounded bg-cobalt-deep px-4 py-2 text-[13px] font-semibold text-ink transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        Request the bot
      </Link>
    </div>
  );
}
