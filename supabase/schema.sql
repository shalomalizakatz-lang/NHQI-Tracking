-- Suggested Supabase schema for the NHQI Multi-Facility Tracker.
-- The app currently persists to localStorage (see src/lib/storage.js) so it works
-- with zero setup. This schema is provided for moving that persistence to Supabase
-- so a portfolio can be shared across devices/users — swap the bodies of the
-- functions in src/lib/storage.js for Supabase calls against these tables.

create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  doh_facility_id text not null unique, -- matches "id" in the bundled NHQI dataset
  name text not null,
  opcert text,
  beds integer,
  created_at timestamptz not null default now()
);

-- Read-only reference data (2023 DOH actuals). Optional: the app can also read
-- this straight from the bundled/uploaded JSON dataset instead of a table.
create table if not exists facility_actuals (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  measure_id text not null,
  value numeric,
  quintile text,
  points numeric,
  year text not null,
  unique (facility_id, measure_id, year)
);

-- User-entered full-year numbers (e.g. 2025) used to project the next NHQI cycle.
create table if not exists facility_inputs (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  measure_id text not null,
  value numeric,
  star_value integer,
  binary_value text,
  updated_at timestamptz not null default now(),
  unique (facility_id, measure_id)
);

create index if not exists facility_actuals_facility_id_idx on facility_actuals(facility_id);
create index if not exists facility_inputs_facility_id_idx on facility_inputs(facility_id);
