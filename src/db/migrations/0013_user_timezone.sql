-- The rep's IANA timezone, captured from their browser.
--
-- The server renders in UTC. Without knowing the reader's zone, grouping calls
-- by day puts a 04:00 meeting under the previous date while still printing
-- 04:00 next to it.
alter table "users" add column if not exists "timezone" text;
