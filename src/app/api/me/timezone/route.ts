/**
 * Record the rep's timezone, as their browser reports it.
 *
 * The server renders in UTC and has no other way to know. Sent once per session
 * by `TimezoneSync`, and only when it differs from what is stored.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { handler, requireUser } from "@/lib/api";

export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const timezone = typeof body?.timezone === "string" ? body.timezone.trim() : "";

  // Validated by asking the platform to use it: an unknown zone throws, and an
  // unvalidated string would break every date on the page rather than one.
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return NextResponse.json({ error: "Unrecognised timezone" }, { status: 400 });
  }

  await db.update(users).set({ timezone }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true, timezone });
});
