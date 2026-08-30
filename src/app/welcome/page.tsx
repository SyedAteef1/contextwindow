import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { Page } from "@/components/chrome";
import { OnboardingForm } from "@/components/onboarding-form";
import { currentUser } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Welcome — Context Window" };

/**
 * The one screen between signing in and the product.
 *
 * Asked once, and only once: `onboardedAt` is set whether they answer or skip,
 * so nobody is stopped twice. Anyone who has already been through it and comes
 * back here is sent on rather than shown it again.
 */
export default async function WelcomePage() {
  const user = await currentUser();
  if (!user.workspaceId) redirect("/meetings");

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, user.workspaceId),
  });
  if (!workspace || workspace.onboardedAt) redirect("/meetings");

  return (
    <Page current="meetings" className="max-w-2xl">
      <div className="pt-6">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
          One question, then you&rsquo;re in
        </p>
        <h1 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-[-0.022em] text-ink">
          What does {workspace.name} sell?
        </h1>
        <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-muted">
          A brief written without this reads like a Wikipedia entry on your buyer. Written with it,
          it reads like someone on your team wrote it. This takes about ten seconds.
        </p>

        <div className="mt-9 rounded-lg border border-rule bg-surface p-6 sm:p-8">
          <OnboardingForm companyName={workspace.name} />
        </div>
      </div>
    </Page>
  );
}
