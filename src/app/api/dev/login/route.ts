/**
 * Sign in as the seeded rep, without Google.
 *
 * Refuses to run in production — the whole point is to let you look at the
 * product locally before wiring up OAuth.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { handler } from "@/lib/api";
import { env } from "@/lib/env";
import { setSessionCookie } from "@/lib/session";

export const GET = handler(async (request: Request) => {
  if (env().NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const email = new URL(request.url).searchParams.get("email") ?? "rep@northstar.io";
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    return NextResponse.json(
      { error: `No user ${email}. Run \`npm run db:seed\` first.` },
      { status: 404 },
    );
  }

  await setSessionCookie({ userId: user.id, email: user.email });
  return NextResponse.redirect(new URL("/meetings", env().APP_URL));
});
