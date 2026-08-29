-- What a rep actually did.
--
-- A short list rather than every click: the question is "is this account
-- getting value", and a log of everything answers that worse than one holding
-- only the moments where the product delivered or was used.
--
-- No IP address and no device fingerprint, matching what the privacy policy
-- already promises about sign-ins. A row is a user, a verb, a subject, a time.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_action') then
    create type "activity_action" as enum (
      'calendar_synced',
      'brief_generated',
      'brief_opened',
      'transcript_uploaded',
      'chat_asked',
      'followup_approved',
      'followup_rejected',
      'recap_sent',
      'upgrade_requested'
    );
  end if;
end
$$;

create table if not exists "activity_events" (
  "id"           uuid primary key default gen_random_uuid(),
  "user_id"      uuid not null references "users"("id") on delete cascade,
  "action"       "activity_action" not null,
  "subject_type" text,
  "subject_id"   uuid,
  "detail"       jsonb,
  "created_at"   timestamptz not null default now()
);

-- What did this rep do, and what happened lately. Both read in time order.
create index if not exists "ix_activity_user_time" on "activity_events" ("user_id", "created_at");
create index if not exists "ix_activity_time" on "activity_events" ("created_at");
