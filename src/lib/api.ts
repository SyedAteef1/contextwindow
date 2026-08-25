/**
 * Shared plumbing for route handlers: authentication, ownership checks, and a
 * single error-to-response mapping so failures look the same everywhere.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts, meetings, users, type User } from "@/db/schema";
import { ConfigurationError } from "./env";
import { readSession } from "./session";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const unauthorized = (message = "Not signed in") => new ApiError(401, message);
export const forbidden = (message = "Not your resource") => new ApiError(403, message);
export const notFound = (message = "Not found") => new ApiError(404, message);
export const paymentRequired = (message: string) => new ApiError(402, message);

/** The signed-in rep, or 401. */
export async function requireUser(): Promise<User> {
  const session = await readSession();
  if (!session) throw unauthorized();

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) throw unauthorized("Session refers to a user that no longer exists");
  return user;
}

/** An account, checked to belong to this rep. */
export async function requireOwnedAccount(userId: string, accountId: string) {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, accountId), eq(accounts.ownerUserId, userId)),
  });
  if (!account) throw notFound("Account not found");
  return account;
}

/** A meeting, checked to belong to this rep. */
export async function requireOwnedMeeting(userId: string, meetingId: string) {
  const meeting = await db.query.meetings.findFirst({
    where: and(eq(meetings.id, meetingId), eq(meetings.ownerUserId, userId)),
  });
  if (!meeting) throw notFound("Meeting not found");
  return meeting;
}

/**
 * Wrap a handler so thrown `ApiError`s become their status and everything else
 * becomes a 500 — with the detail logged rather than returned.
 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      if (error instanceof ConfigurationError) {
        // Not a fault — the deployment is missing a value. Say exactly which,
        // because the person reading this is the one who can fix it.
        console.error("Configuration error:", error.message);
        return NextResponse.json(
          { error: `This feature isn't configured yet: ${error.message}` },
          { status: 503 },
        );
      }
      console.error("Unhandled route error:", error);
      const message = error instanceof Error ? error.message : "Unexpected error";
      return NextResponse.json(
        { error: "Something went wrong", detail: message },
        { status: 500 },
      );
    }
  };
}

/** Parse and validate a JSON body, or 400. */
export async function readJson<T>(
  request: Request,
  parse: (value: unknown) => T,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  try {
    return parse(raw);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Invalid request body");
  }
}
