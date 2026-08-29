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
 * Emerald rather than amber. Nothing has gone wrong: the free plan did exactly
 * what it promises, and this is an offer. Amber here would read as a failure
 * and make a working product look broken.
 */
export function UpgradePrompt({
  companyName,
  when,
}: {
  companyName?: string | null;
  when?: string | null;
}) {
  return (
    <div className="rounded-lg border border-volt/25 bg-volt/[0.05] px-5 py-4">
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
        className="mt-3.5 inline-flex items-center rounded bg-volt px-4 py-2 text-[13px] font-semibold text-ground transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        Request the bot
      </Link>
    </div>
  );
}
