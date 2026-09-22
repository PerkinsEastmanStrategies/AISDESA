-- General space photo moves from pre-walk state onto the room survey itself.
--
-- The photo is taken while assessing the room, not during the building pre-walk, so storing
-- it in PreWalkState put it on a separate school-scoped store with its own polling sync.
-- Uploading one therefore rewrote pre-walk state mid-survey and visibly reset the page.
--
-- general_photos_updated_at is supplied by the client, not the esa_set_updated_at trigger,
-- so an edit made offline keeps the time it was actually made. Nullable with no backfill:
-- rooms whose photo still lives in pre-walk state keep reading it from there.
--
-- Apply in Supabase -> SQL Editor BEFORE deploying the app build, then reload the field app.

alter table esa_survey_rooms
  add column if not exists general_photos text[] not null default '{}';

alter table esa_survey_rooms
  add column if not exists general_photos_updated_at timestamptz;
