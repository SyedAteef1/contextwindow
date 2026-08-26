import Link from "next/link";
import { notFound } from "next/navigation";

import { ChatPanel } from "@/components/chat-panel";
import { Page } from "@/components/chrome";
import { BackLink, Card, Eyebrow, Pill, SignalMeter } from "@/components/ui";
import {
  clockTime,
  dealStageLabel,
  shortDate,
  statusLabel,
  trimCompanyPrefix,
} from "@/lib/format";
import { currentUser, loadAccountDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await params;
  const detail = await loadAccountDetail(user.id, id);
  if (!detail) notFound();

  const { account, contacts, history, usage } = detail;
  const processed = history.filter((meeting) => meeting.summaryId);

  return (
    <Page current="accounts">
      <BackLink href="/accounts">All accounts</BackLink>

      <div className="mt-5 mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-7">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-[-0.028em] text-ink">
            {account.companyName}
          </h1>
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
            {account.domain}
            {account.industry ? ` · ${account.industry}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Pill tone="quiet">{dealStageLabel(account.dealStage)}</Pill>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            {usage.used} of {usage.limit} free meetings used
          </span>
        </div>
      </div>

      {usage.overLimit && (
        <div className="mb-8 rounded-lg border border-signal/30 bg-signal-soft px-5 py-4">
          <Eyebrow>Free limit reached</Eyebrow>
          <p className="mt-1.5 text-[13.5px] text-ink-soft">
            {account.companyName} has used all {usage.limit} free meetings this month. New calls are
            still recorded and searchable, but summaries and buying signals pause until the counter
            resets on the 1st — or until you upgrade.
          </p>
        </div>
      )}

      <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* --- Chat: the reason to open an account page --------------------- */}
        <section className="lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <ChatPanel
            accountId={account.id}
            companyName={account.companyName}
            hasHistory={processed.length > 0}
          />
        </section>

        <div className="space-y-9 lg:order-1">
          <section>
            <SectionHead label="Call history" aside={`${history.length} total`} />
            {history.length === 0 ? (
              <Card className="px-5 py-6 text-center text-[13.5px] text-muted">
                No calls with {account.companyName} yet.
              </Card>
            ) : (
              <ul className="divide-y divide-rule-soft overflow-hidden rounded-lg border border-rule bg-surface">
                {history.map((meeting) => (
                  <li key={meeting.id}>
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-ground/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] text-ink">
                          {trimCompanyPrefix(meeting.title, account.companyName, account.domain)}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                          {shortDate(meeting.scheduledAt)} · {clockTime(meeting.scheduledAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {meeting.intentSignals && (
                          <SignalMeter
                            interest={meeting.intentSignals.buyingInterest}
                            showLabel={false}
                          />
                        )}
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted group-hover:text-ink">
                          {statusLabel(meeting.status)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionHead label="People" aside={`${contacts.length} known`} />
            {contacts.length === 0 ? (
              <Card className="px-5 py-6 text-center text-[13.5px] text-muted">
                Contacts are added automatically from calendar invites.
              </Card>
            ) : (
              <ul className="divide-y divide-rule-soft overflow-hidden rounded-lg border border-rule bg-surface">
                {contacts.map((contact) => (
                  <li
                    key={contact.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
                  >
                    <div>
                      <p className="text-[14px] text-ink">{contact.name ?? contact.email}</p>
                      <p className="mt-0.5 font-mono text-[10px] tracking-[0.05em] text-faint">
                        {contact.email}
                        {contact.role ? ` · ${contact.role}` : ""}
                      </p>
                    </div>
                    {contact.isDecisionMaker && <Pill tone="signal">Decision maker</Pill>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Page>
  );
}

function SectionHead({ label, aside }: { label: string; aside?: string }) {
  return (
    <div className="mb-3.5 flex items-baseline gap-3">
      <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.08em] text-ink">
        {label}
      </h2>
      <span className="h-px flex-1 bg-rule" aria-hidden />
      {aside && (
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{aside}</span>
      )}
    </div>
  );
}
