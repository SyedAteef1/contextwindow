// "Book a demo" lead intake. Posts each request to Slack (primary) AND saves to MongoDB
// (best-effort). The lead is recorded as long as EITHER succeeds, so a flaky DB never loses
// a lead and the prospect never sees an error.

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Registration from '@/models/Registration';
import { slackPostMessage } from '@/lib/slack/client';

export const runtime = 'nodejs';

// Destination channel for demo leads. Override with SLACK_DEMO_CHANNEL in .env.
const LEADS_CHANNEL = process.env.SLACK_DEMO_CHANNEL ?? 'C0BC27G9YDS';

async function notifySlack(lead: Record<string, string>): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn('SLACK_BOT_TOKEN not set — skipping Slack notification');
    return false;
  }
  const text =
    '🚀 *New demo request*\n' +
    `*Name:* ${lead.name ?? '—'}\n` +
    `*Work email:* ${lead.email ?? '—'}\n` +
    `*Company:* ${lead.company ?? '—'}\n` +
    `*Phone:* ${lead.phone ?? '—'}\n` +
    `*Team size:* ${lead.teamSize || '—'}\n` +
    `*Wants to see:* ${lead.message || '—'}`;
  try {
    const res = await slackPostMessage(token, LEADS_CHANNEL, text);
    if (!res.ok) console.error('Slack notify failed:', res.error);
    return res.ok;
  } catch (err) {
    console.error('Slack notify error:', err);
    return false;
  }
}

async function saveToMongo(body: Record<string, unknown>): Promise<boolean> {
  try {
    await dbConnect();
    await Registration.create(body);
    return true;
  } catch (err) {
    console.error('Registration (Mongo) error:', err instanceof Error ? err.message : err);
    return false;
  }
}

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const [slackOk, dbOk] = await Promise.all([notifySlack(body), saveToMongo(body)]);

  if (slackOk || dbOk) {
    return NextResponse.json({ success: true, slack: slackOk, db: dbOk }, { status: 201 });
  }
  return NextResponse.json(
    { success: false, error: 'Could not record your request right now. Please email us.' },
    { status: 502 },
  );
}
