-- Per-answer edit time, stamped on the device when the assessor changes an answer.
--
-- Merges previously resolved conflicts by counting answers, which cannot represent a
-- removal: clearing a note or a photo makes a copy smaller, not older, so the edit was
-- discarded as if it came from a stale device.
--
-- The existing updated_at cannot be used for this. Its trigger stamps write time, so an
-- edit made offline at 10:05 and synced at 11:00 would look newer than it is. This column
-- is supplied by the client and never touched by the trigger.
--
-- Nullable with no backfill: answers written before this column existed keep resolving by
-- size, so nothing already in the database shifts.
--
-- Apply in Supabase → SQL Editor BEFORE deploying the app build, then reload the field app.

alter table esa_question_responses
  add column if not exists client_updated_at timestamptz;
