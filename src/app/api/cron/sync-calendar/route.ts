/**
 * Scheduled calendar sync (Vercel Cron).
 *
 * This is the only recurring job the system needs. Bots join by themselves via
 * the provider's scheduled-bot support, and transcripts arrive by webhook, so
 * nothing here has to run at minute resolution.
 */
import { NextResponse } from "next/server";

import { handler } from "@/lib/api";
import { timingSafeEqualString } from "@/lib/crypto";
import { env } from "@/lib/env";
import { syncAllCalendars } from "@/lib/pipeline/calendar-sync";

export const maxDuration = 300;

export const GET = handler(async (request: Request) => {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!timingSafeEqualString(token, env().CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllCalendars();

  const totals = results.reduce(
    (accumulator, result) => ({
      users: accumulator.users + 1,
      created: accumulator.created + result.created,
      botsScheduled: accumulator.botsScheduled + result.botsScheduled,
      briefsGenerated: accumulator.briefsGenerated + result.briefsGenerated,
      quotaSkipped: accumulator.quotaSkipped + result.quotaSkipped,
      errors: accumulator.errors + result.errors.length,
    }),
    { users: 0, created: 0, botsScheduled: 0, briefsGenerated: 0, quotaSkipped: 0, errors: 0 },
  );

  return NextResponse.json({ ok: true, totals, results });
});
