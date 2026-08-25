-- Emailing a brief is a different event from opening one in the app, so it
-- needs its own timestamp: otherwise reading a brief would suppress its email,
-- and a failed send would look like a delivered one.
ALTER TABLE "meeting_briefs" ADD COLUMN "emailed_at" timestamp with time zone;
