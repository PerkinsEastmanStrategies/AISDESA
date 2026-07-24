# AISD-Survey

Mobile-first field survey app for Austin ISD Educational Suitability Assessment (ESA) scores.

## Run locally

From the repo root (requires [pnpm](https://pnpm.io)):

```bash
pnpm install
pnpm --filter aisd-survey dev
```

Open [http://localhost:3002](http://localhost:3002).

## Structure

- **AISD-Survey/** — Next.js app (port 3002)
- **packages/shared/** — Shared types, rubric, scoring, and floor-plan config used by this app and the **AISD/** dashboard

## Current scope

- Survey tabs: Studios, Outdoor Elements, Administration, and more
- Studios rubric CSVs in the app root (`Questions.csv`, `QuestionOptions.csv`, `Categories.csv`, `Subcategories.csv`); regenerate with `node scripts/generate-studio-rubric.mjs`
- Administration CSV package in `packages/shared/src/data/admin-survey/` (Admin Office + Counseling Suite); regenerate with `node scripts/generate-admin-rubric.mjs`
- Arrival + PLC package in `packages/shared/src/data/arrival-admin-survey/` (Main Office, Community Partner Suite, Professional Learning Center); regenerate with `node scripts/generate-arrival-admin-rubric.mjs`
- Neighborhoods package in `packages/shared/src/data/neighborhood-survey/` (Neighborhood, Group Room, Open Collaboration Space); regenerate with `node scripts/generate-neighborhood-rubric.mjs`
- School picker from `public/data/aisd-schools.geojson`
- Lively Middle School floor plans (L1, L2, L3, LB) with room pick + score hotspots
- Real-time category and room scoring → `FloorPlanRoom` shape for dashboard sync (Supabase later)

## Select Lively

Choose **Lively Middle School** in the school dropdown to load interactive floor plans.
