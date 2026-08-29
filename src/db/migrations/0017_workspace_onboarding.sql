-- What the seller can tell us about themselves.
--
-- The website is asked for once at sign-up because it is the highest-yield
-- question available: one URL yields positioning, product language and often a
-- customer list, with nobody typing a paragraph. `ideal_customer` is the
-- answer to "what are you looking for", which steers research towards the
-- signals this team actually cares about.
alter table "workspaces" add column if not exists "website" text;
alter table "workspaces" add column if not exists "ideal_customer" text;
alter table "workspaces" add column if not exists "onboarded_at" timestamptz;
