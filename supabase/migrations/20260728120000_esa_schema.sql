-- AISD ESA Survey — Supabase schema
-- Prefix: esa_
--
-- Edit model:
--   • "Current state" tables are upserted on every save/edit (source of truth for the app).
--   • esa_submission_snapshots stores immutable copies on module submit + campus submit.
--   • esa_response_revisions (optional audit) logs each response change after first submit.
--
-- Apply: Supabase Dashboard → SQL Editor, or `supabase db push`

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type esa_survey_type as enum (
    'studios',
    'outdoor',
    'neighborhoods',
    'arrival',
    'administration',
    'athletics',
    'performing_arts',
    'cte',
    'shared_spaces',
    'closeout'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type esa_submission_kind as enum ('module', 'campus');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type esa_photo_kind as enum ('question', 'prewalk_space_type');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type esa_campus_status as enum (
    'not_started',
    'in_progress',
    'campus_submitted',
    'qa_finalized'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function esa_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schools (reference cache — optional sync from aisd-schools.geojson)
-- ---------------------------------------------------------------------------
create table if not exists esa_schools (
  school_id         text primary key,
  campus_id         text not null,
  name              text not null,
  display_name      text,
  school_class      text,
  address           text,
  city              text default 'Austin',
  state             text default 'TX',
  zip               text,
  lat               double precision,
  lng               double precision,
  has_floor_plan    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists esa_schools_campus_id_idx on esa_schools (campus_id);

-- ---------------------------------------------------------------------------
-- Campus assessment (one row per school walk — parent for all modules)
-- ---------------------------------------------------------------------------
create table if not exists esa_campus_assessments (
  id                    uuid primary key default gen_random_uuid(),
  school_id             text not null references esa_schools (school_id) on delete restrict,
  campus_id             text not null,
  school_name           text not null,
  status                esa_campus_status not null default 'not_started',
  final_comment         text,
  campus_submitted_at   timestamptz,
  campus_submitted_by   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists esa_campus_assessments_school_id_idx
  on esa_campus_assessments (school_id);

create trigger esa_campus_assessments_updated_at
  before update on esa_campus_assessments
  for each row execute function esa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Assessors (registered field users — deduped by email)
-- ---------------------------------------------------------------------------
create table if not exists esa_assessors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null,
  registered_at   timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint esa_assessors_email_unique unique (email)
);

create trigger esa_assessors_updated_at
  before update on esa_assessors
  for each row execute function esa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Survey sessions (one current row per school + survey module)
-- Maps to SurveySession in the app; upsert on save.
-- ---------------------------------------------------------------------------
create table if not exists esa_survey_sessions (
  id                        uuid primary key default gen_random_uuid(),
  survey_id                 text not null,
  campus_assessment_id      uuid references esa_campus_assessments (id) on delete set null,
  school_id                 text not null references esa_schools (school_id) on delete restrict,
  campus_id                 text not null,
  school_name               text not null,
  survey_type               esa_survey_type not null,
  building                  text not null default 'Main',
  assessor_id               uuid references esa_assessors (id) on delete set null,
  assessor_name             text,
  assessor_email            text,
  assessor_registered_at    timestamptz,
  started_at                timestamptz not null,
  submitted_at                timestamptz,
  final_comment             text,
  campus_submitted_at       timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint esa_survey_sessions_school_type_unique unique (school_id, survey_type),
  constraint esa_survey_sessions_survey_id_unique unique (survey_id)
);

create index if not exists esa_survey_sessions_campus_assessment_idx
  on esa_survey_sessions (campus_assessment_id);

create index if not exists esa_survey_sessions_school_id_idx
  on esa_survey_sessions (school_id);

create trigger esa_survey_sessions_updated_at
  before update on esa_survey_sessions
  for each row execute function esa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Manual rooms (not on floor plan SVG)
-- ---------------------------------------------------------------------------
create table if not exists esa_manual_rooms (
  school_id       text not null references esa_schools (school_id) on delete cascade,
  room_id         text not null,
  name            text not null,
  x               double precision not null default 0,
  y               double precision not null default 0,
  area            double precision not null default 0,
  building        text,
  neighborhood    text,
  area_sqft       double precision,
  level_id        text not null default 'floor-1',
  points          jsonb not null default '[]'::jsonb,
  overlay_kind    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (school_id, room_id)
);

create trigger esa_manual_rooms_updated_at
  before update on esa_manual_rooms
  for each row execute function esa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Pre-walk (school-level, spans survey modules)
-- ---------------------------------------------------------------------------
create table if not exists esa_prewalk_state (
  school_id       text primary key references esa_schools (school_id) on delete cascade,
  campus_id       text not null,
  completed_at    timestamptz,
  skipped_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger esa_prewalk_state_updated_at
  before update on esa_prewalk_state
  for each row execute function esa_set_updated_at();

create table if not exists esa_prewalk_mappings (
  school_id       text not null references esa_schools (school_id) on delete cascade,
  campus_id       text not null,
  survey_type     esa_survey_type not null,
  room_id         text not null,
  space_type      text not null,
  note1           text,
  note2           text,
  mapped_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (school_id, survey_type, room_id)
);

create index if not exists esa_prewalk_mappings_school_idx
  on esa_prewalk_mappings (school_id);

create trigger esa_prewalk_mappings_updated_at
  before update on esa_prewalk_mappings
  for each row execute function esa_set_updated_at();

create table if not exists esa_prewalk_photos (
  id              uuid primary key default gen_random_uuid(),
  school_id       text not null references esa_schools (school_id) on delete cascade,
  campus_id       text not null,
  survey_type     esa_survey_type not null,
  room_id         text,
  space_type      text not null,
  photo_id        text,
  storage_path    text not null,
  public_url      text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One active photo per pre-walk slot (room-scoped when room_id is set)
create unique index if not exists esa_prewalk_photos_slot_unique
  on esa_prewalk_photos (school_id, survey_type, coalesce(room_id, ''), space_type);

create trigger esa_prewalk_photos_updated_at
  before update on esa_prewalk_photos
  for each row execute function esa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Survey rooms (current state — editable after submit)
-- ---------------------------------------------------------------------------
create table if not exists esa_survey_rooms (
  survey_session_id                         uuid not null references esa_survey_sessions (id) on delete cascade,
  room_id                                   text not null,
  room_number                               text not null default '',
  school_room_number                        text,
  room_type                                 text not null default '',
  grade_type                                text not null default '',
  neighborhood                              text,
  area_sqft                                 double precision,
  building                                  text,
  level_id                                  text not null default 'floor-1',
  pre_walk_note1                            text,
  pre_walk_note2                            text,
  source_survey_type                        esa_survey_type,
  pending_question_ids                      jsonb not null default '[]'::jsonb,
  pending_grade                             boolean not null default false,
  deferred_question_ids                     jsonb not null default '[]'::jsonb,
  deferred_to_closeout                      boolean not null default false,
  traditional_studio_copied_from_room_id    text,
  traditional_studio_copy_review_pending    boolean not null default false,
  created_at                                timestamptz not null default now(),
  updated_at                                timestamptz not null default now(),
  primary key (survey_session_id, room_id)
);

create index if not exists esa_survey_rooms_session_idx
  on esa_survey_rooms (survey_session_id);

create trigger esa_survey_rooms_updated_at
  before update on esa_survey_rooms
  for each row execute function esa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Question responses (current state — upsert on edit)
-- value: JSON string OR array of strings for multi-select
-- ---------------------------------------------------------------------------
create table if not exists esa_question_responses (
  survey_session_id   uuid not null references esa_survey_sessions (id) on delete cascade,
  room_id             text not null,
  question_id         text not null,
  value               jsonb,
  comment             text,
  photos              text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (survey_session_id, room_id, question_id),
  foreign key (survey_session_id, room_id)
    references esa_survey_rooms (survey_session_id, room_id)
    on delete cascade
);

create index if not exists esa_question_responses_session_idx
  on esa_question_responses (survey_session_id);

create index if not exists esa_question_responses_question_idx
  on esa_question_responses (question_id);

create trigger esa_question_responses_updated_at
  before update on esa_question_responses
  for each row execute function esa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Outdoor element map pins
-- ---------------------------------------------------------------------------
create table if not exists esa_outdoor_pins (
  survey_session_id   uuid not null references esa_survey_sessions (id) on delete cascade,
  pin_id              text not null,
  element_type        text not null,
  lng                 double precision not null,
  lat                 double precision not null,
  placed_at           timestamptz not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (survey_session_id, pin_id)
);

create index if not exists esa_outdoor_pins_session_idx
  on esa_outdoor_pins (survey_session_id);

create index if not exists esa_outdoor_pins_element_type_idx
  on esa_outdoor_pins (element_type);

create trigger esa_outdoor_pins_updated_at
  before update on esa_outdoor_pins
  for each row execute function esa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Photo registry (links Storage objects to survey entities)
-- Bucket: "ESA Pictures" (or NEXT_PUBLIC_SUPABASE_PHOTOS_BUCKET)
-- ---------------------------------------------------------------------------
create table if not exists esa_photos (
  id                  uuid primary key default gen_random_uuid(),
  school_id           text not null references esa_schools (school_id) on delete cascade,
  campus_id           text not null,
  survey_type         esa_survey_type not null,
  kind                esa_photo_kind not null,
  room_id             text,
  question_id         text,
  space_type          text,
  photo_id            text,
  storage_path        text not null,
  public_url          text not null,
  survey_session_id   uuid references esa_survey_sessions (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint esa_photos_storage_path_unique unique (storage_path)
);

create index if not exists esa_photos_school_idx on esa_photos (school_id);
create index if not exists esa_photos_session_idx on esa_photos (survey_session_id);

create trigger esa_photos_updated_at
  before update on esa_photos
  for each row execute function esa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Submission snapshots (immutable — written on module submit & campus submit)
-- ---------------------------------------------------------------------------
create table if not exists esa_submission_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  survey_session_id   uuid not null references esa_survey_sessions (id) on delete cascade,
  campus_assessment_id uuid references esa_campus_assessments (id) on delete set null,
  school_id           text not null,
  campus_id           text not null,
  survey_type         esa_survey_type not null,
  kind                esa_submission_kind not null,
  revision_number     integer not null default 1,
  submitted_at        timestamptz not null default now(),
  submitted_by        text,
  session_json        jsonb not null,
  campus_json         jsonb,
  floor_plan_rooms    jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists esa_submission_snapshots_session_idx
  on esa_submission_snapshots (survey_session_id, submitted_at desc);

create index if not exists esa_submission_snapshots_school_idx
  on esa_submission_snapshots (school_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- Response revision log (audit trail after first module submit)
-- ---------------------------------------------------------------------------
create table if not exists esa_response_revisions (
  id                  uuid primary key default gen_random_uuid(),
  survey_session_id   uuid not null references esa_survey_sessions (id) on delete cascade,
  room_id             text not null,
  question_id         text not null,
  revision_number     integer not null,
  value               jsonb,
  comment             text,
  photos              text[] not null default '{}',
  changed_by          text,
  changed_at          timestamptz not null default now()
);

create index if not exists esa_response_revisions_lookup_idx
  on esa_response_revisions (survey_session_id, room_id, question_id, revision_number desc);

-- ---------------------------------------------------------------------------
-- QA finalization (admin sign-off)
-- ---------------------------------------------------------------------------
create table if not exists esa_qa_finalizations (
  school_id           text primary key references esa_schools (school_id) on delete cascade,
  campus_id           text not null,
  campus_assessment_id uuid references esa_campus_assessments (id) on delete set null,
  reviewer_name       text not null,
  reviewer_email      text not null,
  finalized_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger esa_qa_finalizations_updated_at
  before update on esa_qa_finalizations
  for each row execute function esa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Convenience view: latest submission per module
-- ---------------------------------------------------------------------------
create or replace view esa_latest_module_submissions as
select distinct on (survey_session_id)
  id,
  survey_session_id,
  school_id,
  survey_type,
  kind,
  revision_number,
  submitted_at,
  campus_json
from esa_submission_snapshots
where kind = 'module'
order by survey_session_id, submitted_at desc;

-- ---------------------------------------------------------------------------
-- Row Level Security (permissive defaults — tighten before production)
-- ---------------------------------------------------------------------------
alter table esa_schools enable row level security;
alter table esa_campus_assessments enable row level security;
alter table esa_assessors enable row level security;
alter table esa_survey_sessions enable row level security;
alter table esa_manual_rooms enable row level security;
alter table esa_prewalk_state enable row level security;
alter table esa_prewalk_mappings enable row level security;
alter table esa_prewalk_photos enable row level security;
alter table esa_survey_rooms enable row level security;
alter table esa_question_responses enable row level security;
alter table esa_outdoor_pins enable row level security;
alter table esa_photos enable row level security;
alter table esa_submission_snapshots enable row level security;
alter table esa_response_revisions enable row level security;
alter table esa_qa_finalizations enable row level security;

-- Authenticated users can read/write all ESA tables (replace with role-based policies)
do $$ declare t text; begin
  foreach t in array array[
    'esa_schools',
    'esa_campus_assessments',
    'esa_assessors',
    'esa_survey_sessions',
    'esa_manual_rooms',
    'esa_prewalk_state',
    'esa_prewalk_mappings',
    'esa_prewalk_photos',
    'esa_survey_rooms',
    'esa_question_responses',
    'esa_outdoor_pins',
    'esa_photos',
    'esa_submission_snapshots',
    'esa_response_revisions',
    'esa_qa_finalizations'
  ] loop
    execute format(
      'create policy "esa_authenticated_all_%s" on %I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
exception when duplicate_object then null;
end $$;

-- Service role bypasses RLS by default in Supabase.
