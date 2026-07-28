# ESA Supabase Schema

SQL migration for all survey data captured by the AISD ESA field app. Table names use the **`esa_`** prefix (PostgreSQL stores them lowercase).

## Apply the migration

**Option A — Supabase Dashboard**

1. Open your project → **SQL Editor**
2. Paste the contents of `migrations/20260728120000_esa_schema.sql`
3. Run

**Option B — Supabase CLI**

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Environment variables (already in your app)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # server-side writes
NEXT_PUBLIC_SUPABASE_PHOTOS_BUCKET=ESA Pictures
```

Photos stay in **Storage**; `esa_photos` is a registry linking paths to survey entities.

---

## Edit-after-submit model

You asked for submit **and** edit later. The schema uses two layers:

| Layer | Tables | Behavior |
|-------|--------|----------|
| **Current state** | `esa_survey_sessions`, `esa_survey_rooms`, `esa_question_responses`, `esa_prewalk_mappings`, `esa_outdoor_pins`, … | **Upsert** on every save. This is what the app reads when editing. |
| **Submission history** | `esa_submission_snapshots` | **Append-only** when assessor clicks "Save & view results" or "Submit campus assessment". Never updated. |
| **Audit trail** (optional) | `esa_response_revisions` | Append a row when a response changes **after** the module was first submitted. |

The app does **not** need separate "initial" and "edited" tables. It reads current state for edits; snapshots preserve what was submitted at each milestone.

### Upsert keys (natural unique constraints)

| Entity | Upsert on conflict |
|--------|-------------------|
| Survey session | `(school_id, survey_type)` |
| Room | `(survey_session_id, room_id)` |
| Question response | `(survey_session_id, room_id, question_id)` |
| Pre-walk mapping | `(school_id, survey_type, room_id)` |
| Pre-walk photo | `(school_id, survey_type, coalesce(room_id,''), space_type)` |
| Outdoor pin | `(survey_session_id, pin_id)` |
| Manual room | `(school_id, room_id)` |
| Photo registry | `(storage_path)` |

### Example: save / edit a response

```sql
-- After ensuring session + room rows exist:
insert into esa_question_responses (
  survey_session_id, room_id, question_id, value, comment, photos
) values (
  $session_id, $room_id, $question_id,
  '"Yes"'::jsonb,        -- or '["A","B"]'::jsonb for multi-select
  $comment,
  $photos                -- text[] of Supabase public URLs
)
on conflict (survey_session_id, room_id, question_id)
do update set
  value = excluded.value,
  comment = excluded.comment,
  photos = excluded.photos,
  updated_at = now();
```

### Example: record a module submission snapshot

```sql
insert into esa_submission_snapshots (
  survey_session_id, campus_assessment_id, school_id, campus_id,
  survey_type, kind, revision_number, submitted_at, submitted_by,
  session_json, campus_json, floor_plan_rooms
) values (
  $session_id, $campus_id, $school_id, $campus_id,
  $survey_type, 'module', $next_revision, now(), $assessor_email,
  $session_json, $campus_json, $floor_plan_rooms
);
```

---

## Table reference

### Reference & campus

| Table | Purpose |
|-------|---------|
| `esa_schools` | School cache from GeoJSON (`school_id`, `campus_id`, name, class, lat/lng) |
| `esa_campus_assessments` | One campus walk per school; holds `final_comment`, `campus_submitted_at`, status |
| `esa_assessors` | Field assessors (name, email) |

### Survey modules

| Table | Maps to app type | Key fields |
|-------|------------------|------------|
| `esa_survey_sessions` | `SurveySession` | `survey_id`, `school_id`, `survey_type`, assessor, `started_at`, `submitted_at`, `final_comment`, `campus_submitted_at` |
| `esa_survey_rooms` | `RoomSurveySession` | room metadata, closeout/deferral fields, traditional studio copy flags |
| `esa_question_responses` | `RoomQuestionResponse` | `question_id`, `value` (jsonb), `comment`, `photos` (text[]) |
| `esa_outdoor_pins` | `OutdoorElementPin` | `element_type`, `lng`, `lat`, `placed_at` |

### Pre-walk

| Table | Maps to app type | Key fields |
|-------|------------------|------------|
| `esa_prewalk_state` | `PreWalkState` (top) | `completed_at`, `skipped_at` |
| `esa_prewalk_mappings` | `PreWalkRoomMapping` | `space_type`, `note1`, `note2`, `mapped_at` |
| `esa_prewalk_photos` | `PreWalkState.spaceTypePhotos` | `storage_path`, `public_url`, room-scoped or school-scoped |
| `esa_manual_rooms` | `ParsedPlanRoom` (manual) | rooms not on floor plan SVG |

### History & admin

| Table | Purpose |
|-------|---------|
| `esa_submission_snapshots` | Frozen copies on module/campus submit |
| `esa_response_revisions` | Per-response change log after first submit |
| `esa_qa_finalizations` | Admin QA sign-off |
| `esa_photos` | Storage path registry for question + pre-walk photos |

### View

| View | Purpose |
|------|---------|
| `esa_latest_module_submissions` | Most recent module snapshot per survey session |

---

## App field → column mapping

### `RoomQuestionResponse`

| App field | Column | Type |
|-----------|--------|------|
| `questionId` | `question_id` | text |
| `value` | `value` | jsonb (string or string[]) |
| `comment` | `comment` | text |
| `photos` | `photos` | text[] |

### `OutdoorElementPin`

| App field | Column |
|-----------|--------|
| `id` | `pin_id` |
| `elementType` | `element_type` |
| `lng`, `lat` | `lng`, `lat` |
| `placedAt` | `placed_at` |

### `PreWalkRoomMapping`

| App field | Column |
|-----------|--------|
| `surveyType` | `survey_type` |
| `roomId` | `room_id` |
| `spaceType` | `space_type` |
| `note1`, `note2` | `note1`, `note2` |
| `mappedAt` | `mapped_at` |

### Close Out / deferral (on `esa_survey_rooms`)

| App field | Column |
|-----------|--------|
| `sourceSurveyType` | `source_survey_type` |
| `pendingQuestionIds` | `pending_question_ids` (jsonb) |
| `pendingGrade` | `pending_grade` |
| `deferredQuestionIds` | `deferred_question_ids` (jsonb) |
| `deferredToCloseOut` | `deferred_to_closeout` |

---

## Recommended write order

When syncing a full draft from the app:

1. Upsert `esa_schools` (from school picker)
2. Upsert `esa_campus_assessments` (create if missing for school)
3. Upsert `esa_survey_sessions` for each `(school_id, survey_type)`
4. Upsert `esa_prewalk_state`, `esa_prewalk_mappings`, `esa_prewalk_photos`
5. Upsert `esa_manual_rooms`
6. Upsert `esa_survey_rooms` for each room in session
7. Upsert `esa_question_responses` for each answer
8. Upsert `esa_outdoor_pins` (outdoor module)
9. On submit → insert `esa_submission_snapshots`
10. On campus submit → update `esa_campus_assessments.campus_submitted_at` + insert snapshot with `kind = 'campus'`

---

## Row Level Security

The migration enables RLS with permissive **authenticated = full access** policies. Before production:

- Restrict writes to assessors assigned to a school
- Restrict QA finalization to admin role
- Keep snapshots insert-only for field users (no update/delete)

Service role key (used by your Next.js API routes) bypasses RLS.

---

## Next step: wire the app

The schema is ready; the app still saves to **localStorage** only. To connect:

1. Add API routes (or Supabase client helpers) that upsert current-state tables on auto-save
2. Insert snapshots on `SUBMIT` / `SUBMIT_CAMPUS` in `survey-store.tsx`
3. Load drafts from Supabase on school select (fallback to localStorage offline)

Say the word when you want that sync layer implemented.
