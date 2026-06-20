// DEV-ONLY test login — lets us exercise the approval gate without the Google client.
// Disabled in production. e.g. /api/auth/dev?email=you@contravault.com
import { NextResponse } from "next/server";
import { upsertLoginIdentity } from "../../../../lib/auth/approval";
import { setSession } from "../../../../lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("disabled in production", { status: 404 });
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return new NextResponse('usage: /api/auth/dev?email=you@company.com', { status: 400 });
  const row = await upsertLoginIdentity({ surface: "dev", surfaceUserId: email, email, displayName: email.split("@")[0] });
  await setSession(row.principalId);
  return NextResponse.redirect(new URL(row.status === "approved" ? "/app" : "/pending", url.origin));
}
