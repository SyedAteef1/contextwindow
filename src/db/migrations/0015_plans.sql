-- Free research, paid notetaker.
--
-- The brief and the bot used to be gated together on one meter, so a rep who
-- ran out stopped receiving research as well. They are separate entitlements
-- now: the brief is what the free plan *is*, and the bot — recording,
-- transcription, a live model held to half a second — is what `pro` buys.

-- The plan lives on the workspace, because a sales team buys together and the
-- second rep at a company should inherit what the first one paid for.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan') then
    create type "plan" as enum ('free', 'pro');
  end if;
end
$$;

alter table "workspaces"
  add column if not exists "plan" "plan" not null default 'free';

-- Distinct from `skipped_quota`: one means the month is spent, the other means
-- the plan never included a notetaker. Different words, different button.
alter type "meeting_status" add value if not exists 'bot_requires_upgrade';

-- A second meter. Briefs are free but not infinite — the ceiling sits far above
-- a working rep's calendar, so reaching it means something is looping rather
-- than that someone is selling hard.
alter table "usage"
  add column if not exists "briefs_this_month" integer not null default 0;

alter table "usage"
  add column if not exists "brief_limit" integer not null default 25;
