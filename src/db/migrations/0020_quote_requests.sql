-- A signed-in team asking what Pro costs.
--
-- Distinct from demo_requests, which is a stranger with no account. This one
-- already knows who they are, so the form is a seat count and a sentence.
-- A request rather than a checkout: every team gets engineers for setup, so
-- the price depends on what they connect.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type "quote_status" as enum ('requested', 'quoted', 'closed');
  end if;
end
$$;

create table if not exists "quote_requests" (
  "id"           uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id"      uuid not null references "users"("id") on delete cascade,
  "seats"        integer,
  "note"         text,
  "status"       "quote_status" not null default 'requested',
  "quoted_at"    timestamptz,
  "created_at"   timestamptz not null default now()
);

create index if not exists "ix_quote_workspace" on "quote_requests" ("workspace_id");
create index if not exists "ix_quote_status" on "quote_requests" ("status", "created_at");
