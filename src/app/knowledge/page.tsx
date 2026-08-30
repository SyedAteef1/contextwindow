import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { workspaceDocuments, workspaces } from "@/db/schema";
import { AccountKnowledge } from "@/components/account-knowledge";
import { Page, PageHead } from "@/components/chrome";
import { Eyebrow, Pill } from "@/components/ui";
import { WorkspaceProfile } from "@/components/workspace-profile";
import { currentUser } from "@/lib/queries";
import { getUsage, planForUser } from "@/lib/usage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Knowledge — Context Window" };

/**
 * Everything the assistant knows about the company doing the selling.
 *
 * It existed already — the website read at sign-up, the seller's own documents
 * — but only in the database. The scraped site was filed with a null accountId
 * so it would reach every brief, and the only editor for it was mounted on
 * account pages, so the single most important document in the workspace had no
 * screen at all. Context you cannot see is context you cannot correct.
 */
export default async function KnowledgePage() {
  const user = await currentUser();
  if (!user.workspaceId) {
    return (
      <Page current="knowledge">
        <PageHead eyebrow="Knowledge" title="No workspace yet" />
      </Page>
    );
  }

  const [workspace, docs, usage, plan] = await Promise.all([
    db.query.workspaces.findFirst({ where: eq(workspaces.id, user.workspaceId) }),
    db
      .select()
      .from(workspaceDocuments)
      .where(
        and(
          eq(workspaceDocuments.workspaceId, user.workspaceId),
          // Only the seller's own material. Anything filed against a prospect
          // belongs on that account's page, where its context is.
          isNull(workspaceDocuments.accountId),
          eq(workspaceDocuments.isActive, true),
        ),
      ),
    getUsage(user.id),
    planForUser(user.id),
  ]);

  if (!workspace) {
    return (
      <Page current="knowledge">
        <PageHead eyebrow="Knowledge" title="No workspace yet" />
      </Page>
    );
  }

  return (
    <Page current="knowledge">
      <PageHead
        eyebrow="Knowledge"
        title={workspace.name}
        meta={
          <span>
            {docs.length === 0
              ? "Nothing stored yet"
              : `${docs.length} document${docs.length === 1 ? "" : "s"}`}
            {" · "}
            every brief is written against this
          </span>
        }
      />

      <div className="flex flex-col gap-12">
        <section>
          <div className="mb-5 flex items-center gap-2.5">
            <Eyebrow>Who you are</Eyebrow>
          </div>
          <WorkspaceProfile
            website={workspace.website}
            description={workspace.description}
            idealCustomer={workspace.idealCustomer}
          />
        </section>

        <section>
          <div className="mb-5 flex items-center gap-2.5">
            <Eyebrow>Your material</Eyebrow>
            <span className="text-[12.5px] text-faint">
              Pricing, positioning, case studies, objection handling. Retrieved into every brief
              and every answer, for every account.
            </span>
          </div>
          <AccountKnowledge
            accountId={null}
            companyName={workspace.name}
            initial={docs.map((doc) => ({
              id: doc.id,
              title: doc.title,
              content: doc.content,
              kind: doc.kind,
              updatedAt: doc.updatedAt.toISOString(),
            }))}
          />
        </section>

        <section>
          <div className="mb-5">
            <Eyebrow>Your plan</Eyebrow>
          </div>
          <div className="rounded-lg border border-rule bg-surface px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <Pill tone={plan === "pro" ? "neutral" : "quiet"}>
                {plan === "pro" ? "Pro" : "Free"}
              </Pill>
              <p className="text-[13.5px] text-ink-soft">
                {plan === "pro"
                  ? "A notetaker joins your external calls, with live answers and a drafted follow-up."
                  : "Research on every call. The notetaker and live answers are what Pro adds."}
              </p>
            </div>

            <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-rule-soft pt-4">
              <Meter
                label="Briefs this month"
                used={usage.briefsUsed}
                limit={usage.briefLimit}
              />
              {plan === "pro" && (
                <Meter label="Calls processed" used={usage.used} limit={usage.limit} />
              )}
            </dl>

            {plan === "free" && (
              <Link
                href="/#pricing"
                className="mt-4 inline-flex items-center rounded bg-cobalt-deep px-4 py-2 text-[13px] font-semibold text-ink transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                Request the bot
              </Link>
            )}
          </div>
        </section>
      </div>
    </Page>
  );
}

/** A count against its ceiling, with the bar only when it is close to it. */
function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div className="min-w-[10rem]">
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">{label}</dt>
      <dd className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[18px] tabular-nums text-ink">{used}</span>
        <span className="text-[12px] text-faint">of {limit}</span>
      </dd>
      {/* Drawn only past halfway: a bar at 2 of 25 says "nearly empty", which
          is the wrong feeling about a limit nobody will reach. */}
      {pct >= 50 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-rule">
          <div
            className={pct >= 90 ? "h-full bg-signal" : "h-full bg-cobalt"}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
