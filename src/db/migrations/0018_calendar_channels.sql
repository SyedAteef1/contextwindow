-- Push channels on a rep's Google Calendar.
--
-- Polling every five minutes means a meeting booked at 09:00 is not researched
-- until 09:05, which a rep booking a same-day call notices. Google POSTs to us
-- within seconds instead. Channels expire, so the expiry is stored and renewed.
create table if not exists "calendar_channels" (
  "id"          uuid primary key default gen_random_uuid(),
  "user_id"     uuid not null references "users"("id") on delete cascade,
  "channel_id"  text not null,
  "resource_id" text not null,
  "token"       text not null,
  "expires_at"  timestamptz not null,
  "created_at"  timestamptz not null default now()
);

create unique index if not exists "uq_calendar_channel" on "calendar_channels" ("channel_id");
create index if not exists "ix_calendar_channel_user" on "calendar_channels" ("user_id");
create index if not exists "ix_calendar_channel_expiry" on "calendar_channels" ("expires_at");
