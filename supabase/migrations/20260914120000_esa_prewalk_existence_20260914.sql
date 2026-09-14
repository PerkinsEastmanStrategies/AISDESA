-- Pre-walk Yes/No “does this space type exist?” answers.
-- School-scoped, shared across iPads (office + field).
-- Apply in Supabase → SQL Editor, then reload the field app.

create table if not exists esa_prewalk_existence_20260914 (
  school_id     text not null references esa_schools (school_id) on delete cascade,
  campus_id     text not null,
  survey_type   esa_survey_type not null,
  space_type    text not null,
  does_exist    boolean not null,
  answered_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (school_id, survey_type, space_type)
);

create index if not exists esa_prewalk_existence_20260914_school_idx
  on esa_prewalk_existence_20260914 (school_id);

drop trigger if exists esa_prewalk_existence_20260914_updated_at
  on esa_prewalk_existence_20260914;

create trigger esa_prewalk_existence_20260914_updated_at
  before update on esa_prewalk_existence_20260914
  for each row execute function esa_set_updated_at();

alter table esa_prewalk_existence_20260914 enable row level security;

do $$ begin
  create policy "esa_authenticated_all_esa_prewalk_existence_20260914"
    on esa_prewalk_existence_20260914
    for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null;
end $$;
