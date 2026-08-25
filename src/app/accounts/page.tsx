import Link from "next/link";

import { Page, PageHead } from "@/components/chrome";
import { Empty, Pill } from "@/components/ui";
import { dealStageLabel, relativeDay, shortDate } from "@/lib/format";
import { currentUser, listAccounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await currentUser();
  const accounts = await listAccounts(user.id);

  return (
    <Page current="accounts">
      <PageHead
        eyebrow="Every company you've met"
        title="Accounts"
        meta={accounts.length > 0 ? `${accounts.length} tracked` : null}
      />

      {accounts.length === 0 ? (
        <Empty title="No accounts yet">
          An account is created the first time you have a call with someone outside{" "}
          {user.emailDomain}. Check your calendar from the calls page to get started.
        </Empty>
      ) : (
        <ul className="divide-y divide-rule-soft overflow-hidden rounded-lg border border-rule bg-surface">
          {accounts.map((account, index) => (
            <li key={account.id} className="rise" style={{ animationDelay: `${index * 35}ms` }}>
              <Link
                href={`/accounts/${account.id}`}
                className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 transition-colors hover:bg-ground/50"
              >
                <div className="min-w-0">
                  <h2 className="font-display text-[15px] font-semibold tracking-[-0.015em] text-ink">
                    {account.companyName}
                  </h2>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                    {account.domain}
                    {account.industry ? ` · ${account.industry}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <Pill tone="quiet">{dealStageLabel(account.dealStage)}</Pill>

                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    {account.meetingCount} {account.meetingCount === 1 ? "call" : "calls"}
                  </span>

                  <span className="w-40 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                    {account.nextMeetingAt
                      ? `Next ${relativeDay(account.nextMeetingAt)}`
                      : account.lastMeetingAt
                        ? `Last ${shortDate(account.lastMeetingAt)}`
                        : "No calls yet"}
                  </span>

                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink transition-colors group-hover:text-signal">
                    Open →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
