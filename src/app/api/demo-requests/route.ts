/**
 * A demo request from the landing page.
 *
 * Public and unauthenticated, which is the whole point — and also why it is the
 * most exposed route in the app. Three cheap defences, in order of how much
 * they actually catch: a honeypot field no human ever fills, length caps so a
 * request cannot be used to write megabytes into the table, and a per-address
 * cooldown so the same sender cannot flood it.
 */
import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { demoRequests } from "@/db/schema";
import { handler } from "@/lib/api";
import { notify } from "@/lib/notify";

const LIMITS = { name: 120, email: 200, company: 160, teamSize: 40, message: 2000, source: 120 };
const COOLDOWN_MS = 60_000;

/** Deliberately loose: rejecting a valid address is worse than storing a bad one. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function field(body: unknown, key: string, max: number): string {
  const value = (body as Record<string, unknown>)?.[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const POST = handler(async (request: Request) => {
  const body = await request.json().catch(() => null);

  // The honeypot is hidden from people and from screen readers, so anything
  // that fills it is automated. Answer 200 rather than 400: a bot that learns
  // it failed just tries again without the field.
  if (field(body, "website", 200)) return NextResponse.json({ ok: true });

  const name = field(body, "name", LIMITS.name);
  const email = field(body, "email", LIMITS.email).toLowerCase();
  const company = field(body, "company", LIMITS.company);
  const teamSize = field(body, "teamSize", LIMITS.teamSize);
  const message = field(body, "message", LIMITS.message);
  const source = field(body, "source", LIMITS.source);

  if (!name || !company) {
    return NextResponse.json({ error: "Name and company are required" }, { status: 400 });
  }
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ error: "That email address doesn't look right" }, { status: 400 });
  }

  const recent = await db.query.demoRequests.findFirst({
    where: and(
      eq(demoRequests.email, email),
      gt(demoRequests.createdAt, new Date(Date.now() - COOLDOWN_MS)),
    ),
  });
  // Treated as success: a double-submitted form is not an error to the person
  // who sent it, and saying "too fast" invites them to retry.
  if (recent) return NextResponse.json({ ok: true });

  await db.insert(demoRequests).values({
    name,
    email,
    company,
    teamSize: teamSize || null,
    message: message || null,
    source: source || null,
  });

  // Not awaited: the row is written, and the person is waiting on a response.
  notify({ kind: "demo_request", name, email, company, teamSize, message, source });

  return NextResponse.json({ ok: true });
});
