import Link from "next/link";

import LegalLayout from "@/app/legal/layout";
import { Clause, PageTitle } from "@/app/legal/prose";

export const metadata = {
  title: "Terms of Service — Context Window",
  description:
    "The terms you agree to when using Context Window, including recording consent, plan entitlements, and what we do not promise.",
};

/**
 * Terms of service.
 *
 * Required alongside the privacy policy for Google's OAuth branding and
 * verification. Kept short and readable on purpose — a page nobody can read is
 * a page nobody agreed to — and specific where the product genuinely creates
 * obligations: recording consent, and the fact that a model can be wrong
 * mid-call.
 */
export default function TermsPage() {
  return (
    <LegalLayout>
      <PageTitle title="Terms of Service" updated="29 August 2026" />

      <div className="flex flex-col gap-10">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          These terms cover your use of Context Window. They are deliberately short. Where
          something matters — recording other people, and trusting a machine mid-sentence — it is
          spelled out rather than buried.
        </p>

        <Clause id="account" title="Your account">
          <p>
            You need a Google account to sign in, and you must be old enough to enter a contract
            where you live. You are responsible for what happens under your account and for
            keeping access to it secure. Tell us if you think someone else has it.
          </p>
          <p>
            Signing up with a work email address places you in a shared workspace with colleagues
            at the same domain, who can see the account history your calls produce. Use a personal
            address if you do not want that.
          </p>
        </Clause>

        <Clause id="recording" title="Recording, and the consent that is yours to get">
          <p className="text-ink-soft">
            This is the obligation that actually matters. When you let a notetaker join a call, you
            confirm you have whatever consent the law requires from everyone on it. Many
            jurisdictions require all parties to agree before a conversation is recorded.
          </p>
          <p>
            The notetaker joins as a named, visible participant so nobody is recorded secretly. We
            will remove a recording on request from a participant.
          </p>
        </Clause>

        <Clause id="plans" title="Plans and payment">
          <p>
            The free plan covers research: calendar sync and pre-call briefs, subject to a monthly
            limit. Pro adds a notetaker in the call, live answers, and post-call summaries and
            drafts.
          </p>
          <p>
            Billing is not switched on yet. Prices shown on the site are what Pro will cost, and we
            will not charge you without asking first and giving you the chance to say no.
          </p>
        </Clause>

        <Clause id="acceptable" title="What you agree not to do">
          <p>
            Do not use Context Window to record people unlawfully, to break into anyone&rsquo;s
            systems, to resell the service as your own, or to work around its limits. Do not
            upload material you do not have the right to.
          </p>
        </Clause>

        <Clause id="ai" title="The answers are suggestions, not facts">
          <p className="text-ink-soft">
            Context Window uses language models. They are wrong sometimes, including
            confidently. Everything on your screen mid-call is a suggestion, and you are the person
            deciding whether to say it aloud.
          </p>
          <p>
            Nothing is sent to a customer without a human pressing send. That rule is enforced in
            the product, not just written here. Check anything that would embarrass you if it were
            wrong — a date, a price, a contractual term.
          </p>
        </Clause>

        <Clause id="ownership" title="Who owns what">
          <p>
            Your meetings, transcripts and the material generated from them are yours. You give us
            permission to process them to run the service, and nothing else — we do not use your
            content to train models.
          </p>
          <p>The software, design and brand are ours.</p>
        </Clause>

        <Clause id="availability" title="What we do not promise">
          <p>
            The service is provided as-is. We do not promise it will be uninterrupted, that a
            notetaker will always join, or that an answer will always arrive in time — it is
            designed to show nothing rather than something stale, so sometimes it shows nothing.
          </p>
          <p>
            To the extent the law allows, we are not liable for indirect or consequential losses,
            including a deal you did not win. Where liability cannot be excluded, it is limited to
            what you paid us in the previous twelve months.
          </p>
        </Clause>

        <Clause id="ending" title="Ending it">
          <p>
            You can stop at any time by revoking access at{" "}
            <Link
              href="https://myaccount.google.com/permissions"
              className="text-cobalt-bright underline underline-offset-2"
            >
              myaccount.google.com/permissions
            </Link>{" "}
            and asking us to delete your account. We can suspend an account that breaks these
            terms or puts other people at risk, and we will say why.
          </p>
        </Clause>

        <Clause id="changes" title="Changes">
          <p>
            If we change these terms materially we will tell account holders by email before the
            change takes effect. The date at the top always says when this was last revised.
          </p>
        </Clause>

        <Clause id="contact" title="Contact">
          <p>
            <Link
              href="mailto:legal@contextwindowhq.com"
              className="text-cobalt-bright underline underline-offset-2"
            >
              legal@contextwindowhq.com
            </Link>
          </p>
        </Clause>
      </div>
    </LegalLayout>
  );
}
