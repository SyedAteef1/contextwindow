// Clear the session and return to the login page.
import { NextResponse } from "next/server";
import { clearSession } from "../../../../lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", new URL(req.url).origin));
}
