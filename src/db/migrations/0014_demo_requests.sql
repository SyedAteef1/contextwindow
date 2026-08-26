-- Demo requests from the landing page.
--
-- Not tied to a user: there is no account yet, which is the whole point of
-- asking for a demo rather than signing up.
create table if not exists "demo_requests" (
  "id"         uuid primary key default gen_random_uuid(),
  "name"       text not null,
  "email"      text not null,
  "company"    text not null,
  "team_size"  text,
  "message"    text,
  "source"     text,
  "handled_at" timestamptz,
  "created_at" timestamptz not null default now()
);

create index if not exists "ix_demo_requests_created" on "demo_requests" ("created_at");
