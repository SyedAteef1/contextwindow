/** Manual "sync my calendar now" for the signed-in rep. */
import { NextResponse } from "next/server";

import { handler, requireUser } from "@/lib/api";
import { syncUserCalendar } from "@/lib/pipeline/calendar-sync";

export const maxDuration = 300;

export const POST = handler(async () => {
  const user = await requireUser();
  const result = await syncUserCalendar(user.id);
  return NextResponse.json({ result });
});
