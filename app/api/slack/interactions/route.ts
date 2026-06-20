// Slack interactivity endpoint — handles the Approve/Deny buttons on access-request cards.
// Configure in Slack: Interactivity & Shortcuts → Request URL → <domain>/api/slack/interactions
import { NextResponse } from "next/server";
import { decideIdentity } from "../../../../lib/auth/approval";
import { verifySlackSignature } from "../../../../lib/slack/verify";

export const runtime = "nodejs";
const SIGNING = process.env.SLACK_SIGNING_SECRET ?? "";

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySlackSignature(raw, req.headers.get("x-slack-request-timestamp"), req.headers.get("x-slack-signature"), SIGNING)) {
    return new NextResponse("bad signature", { status: 401 });
  }

  const payload = JSON.parse(new URLSearchParams(raw).get("payload") ?? "{}");
  const action = payload.actions?.[0];
  if (!action?.action_id) return new NextResponse("");

  const id = action.value as string;
  const approverId = payload.user?.id as string | undefined;
  const approver = payload.user?.username || approverId || "slack";

  let statusLine: string;
  if (action.action_id === "approve_identity") {
    const row = await decideIdentity(id, "approved", approver);
    statusLine = row ? `✅ *Approved* by <@${approverId}> — ${row.email}` : "⚠️ Request not found";
  } else if (action.action_id === "deny_identity") {
    const row = await decideIdentity(id, "denied", approver);
    statusLine = row ? `⛔ *Denied* by <@${approverId}> — ${row.email}` : "⚠️ Request not found";
  } else {
    return new NextResponse("");
  }

  // Replace the original card so the buttons disappear and the outcome is shown.
  return NextResponse.json({
    replace_original: true,
    text: statusLine,
    blocks: [{ type: "section", text: { type: "mrkdwn", text: statusLine } }],
  });
}
