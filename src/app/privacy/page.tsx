import Link from "next/link";

import LegalLayout from "@/app/legal/layout";
import { Clause, DataTable, PageTitle } from "@/app/legal/prose";

export const metadata = {
  title: "Privacy Policy — Context Window",
  description:
    "What Context Window reads from your Google account, what it stores, who it is shared with, and how to delete it.",
};

/**
 * The privacy policy.
 *
 * Written against the code rather than from a template, because Google's OAuth
 * verification checks that the policy actually describes how each requested
 * scope is used — and because the scopes here are the sensitive kind. Every
 * claim below is traceable: the scopes are `GOOGLE_SCOPES` in
 * `src/lib/google/oauth.ts`, the encryption is `src/lib/crypto.ts`, and the
 * sub-processor list is every external host the server actually calls.
 *
 * If a scope or a vendor changes, this page changes in the same commit.
 */
export default function PrivacyPage() {
  return (
    <LegalLayout>
      <PageTitle title="Privacy Policy" updated="29 August 2026" />

      <div className="flex flex-col gap-10">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Context Window sits between a sales rep&rsquo;s calendar and the calls on it. That means
          we handle real correspondence and real conversations, so this page is specific about
          what we take, what we keep, and what we never touch. It describes the product as it is
          built today, not as it might be.
        </p>

        <Clause id="google" title="What we access in your Google account">
          <p>
            When you connect Google, we ask for five permissions and no others. Google shows you
            this list on the consent screen; it is the same list the code requests.
          </p>
          <DataTable
            rows={[
              ["openid, userinfo.email, userinfo.profile", "To identify you, and to tell an internal colleague from an external buyer by email domain."],
              ["calendar.events", "To read upcoming meetings so we can research them, and to write a follow-up event after you approve it. Read and write — read-only cannot create the follow-up."],
              ["gmail.send", "Send only. To send a recap from your own address, after you press send. We never read, list, or search your mail — this scope does not permit it, and no code path attempts it."],
            ]}
          />
          <p>
            We do not request contacts, Drive, or any mail-reading scope. Your access and refresh
            tokens are encrypted with AES-256-GCM before they touch the database.
          </p>
        </Clause>

        <Clause id="stored" title="What we store">
          <DataTable
            rows={[
              ["Account and profile", "Your name, email address, profile picture and Google account id."],
              ["Calendar events", "Title, time, attendee list and conferencing link for meetings we detect as external sales calls. Internal-only meetings are not processed."],
              ["Recordings and transcripts", "When a notetaker joins a call, the recording and transcript of that call."],
              ["Generated material", "Briefs, summaries, buying signals, drafted follow-ups, and the numeric embeddings that make them searchable."],
              ["Operational records", "Sign-in events, usage counters, and delivery logs for webhooks."],
            ]}
          />
          <p>
            We do not store IP addresses or device fingerprints against your sign-ins. That was a
            deliberate choice: neither is needed to answer &ldquo;who signed up&rdquo;, and both
            would be personal data we would then have to justify keeping.
          </p>
        </Clause>

        <Clause id="recording" title="Recording calls, and the people on them">
          <p>
            When enabled, a notetaker joins your meeting as a visible participant and records it.
            It appears in the participant list under its own name — it does not attend silently.
          </p>
          <p className="text-ink-soft">
            Recording laws differ by country and by state, and several require the consent of
            everyone on the call. You are responsible for having that consent from your
            participants. If you are unsure, announce the recording at the start of the call.
          </p>
        </Clause>

        <Clause id="sharing" title="Who else sees it">
          <p>
            We do not sell personal data, and we do not use your meeting content to train any
            machine learning model — ours or anyone else&rsquo;s. To run the product we pass
            specific data to these providers:
          </p>
          <DataTable
            rows={[
              ["Anthropic, or Z.ai", "Meeting content and account context, to write briefs, summaries and live answers."],
              ["Attendee", "Meeting join links, to place a notetaker in the call and return the recording."],
              ["Voyage AI, or a self-hosted embedding server", "Text to convert into embeddings for search."],
              ["Google", "The scopes above, on your behalf."],
              ["A search provider", "Public company and person names, for pre-call research. Never your meeting content."],
            ]}
          />
          <p>
            We also disclose data where the law requires it, and to a successor if the business is
            acquired — in which case this policy travels with it.
          </p>
        </Clause>

        <Clause id="workspace" title="Who at your company can see your material">
          <p>
            Accounts are grouped into a workspace by email domain, so colleagues who sign up with
            an address at your company share the account history their calls produce. That is the
            point of it: the second rep to talk to a buyer inherits what the first one learned.
          </p>
          <p>
            People on free mail providers — gmail.com, outlook.com and similar — are each given
            their own private workspace instead, keyed on the full address, so strangers never
            share one.
          </p>
        </Clause>

        <Clause id="retention" title="Keeping it, and deleting it">
          <p>
            We keep your material for as long as your account is open, because the product&rsquo;s
            value is the history: a brief written today draws on a call from six months ago.
          </p>
          <p>
            Ask us to delete your account and we remove your profile, tokens, meetings,
            transcripts and generated material. Deleting cascades — removing a user removes
            everything keyed to them. You can revoke our access to Google at any time, separately
            and without asking us, at{" "}
            <Link
              href="https://myaccount.google.com/permissions"
              className="text-cobalt-bright underline underline-offset-2"
            >
              myaccount.google.com/permissions
            </Link>
            . Revoking stops all future access immediately; it does not by itself delete what we
            already hold, so email us if you want that too.
          </p>
        </Clause>

        <Clause id="limited-use" title="Google API Services Limited Use">
          <p className="text-ink-soft">
            Context Window&rsquo;s use and transfer of information received from Google APIs
            adheres to the{" "}
            <Link
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-cobalt-bright underline underline-offset-2"
            >
              Google API Services User Data Policy
            </Link>
            , including the Limited Use requirements. Specifically: we do not use Google user data
            for advertising, we do not sell it, we do not allow humans to read it except with your
            explicit permission, for security purposes, to comply with law, or where the data is
            aggregated and anonymised — and we do not use it to develop or improve generalised AI
            models.
          </p>
        </Clause>

        <Clause id="contact" title="Contact">
          <p>
            Questions, deletion requests, or anything you think this page gets wrong:{" "}
            <Link
              href="mailto:privacy@contextwindowhq.com"
              className="text-cobalt-bright underline underline-offset-2"
            >
              privacy@contextwindowhq.com
            </Link>
            . A person answers.
          </p>
        </Clause>
      </div>
    </LegalLayout>
  );
}
