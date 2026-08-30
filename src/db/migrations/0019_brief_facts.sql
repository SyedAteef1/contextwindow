-- The handful of facts a rep needs before the paragraphs.
--
-- The brief stays prose — the judgement in "builder-stage buyer: fast,
-- technical, founder-led" does not survive being cut into fields. But someone
-- opening this two minutes before a call reads the top of the screen and
-- nothing else, so the four or five things they would hunt for are lifted out.
alter table "meeting_briefs" add column if not exists "facts" jsonb;
