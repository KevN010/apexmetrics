/*
# Thumbnail Arena — Core Schema

## Purpose
Persist thumbnail A/B test analysis sessions and their AI feedback reports so users
can revisit past analyses without re-uploading screenshots and re-running AI calls.

## New Tables

### 1. analyses
Stores a single thumbnail-stats analysis run (output of /api/analyze-stats).
- id (uuid, PK)
- primary_metric_name (text) — metric used to rank thumbnails
- higher_is_better (boolean) — whether higher = better
- experiment_name (text, nullable) — A/B test name if shown
- winner_index (int, nullable) — index of winning variant
- loser_index (int, nullable) — index of losing variant
- lift_percent (numeric, nullable) — percentage lift of winner over loser
- notes (text, nullable) — data-quality / confidence notes
- stats_image (text) — compressed data-URL screenshot
- created_at (timestamptz)

### 2. thumbnails
One row per thumbnail variant within an analysis. Child of analyses.
- id (uuid, PK)
- analysis_id (uuid, FK -> analyses.id ON DELETE CASCADE)
- thumb_index (int) — original position in the screenshot
- rank (int) — rank after sorting (1 = best)
- label (text) — name/label from screenshot
- visual_description (text) — one-sentence description
- impressions (bigint, nullable)
- plays (bigint, nullable)
- play_through_rate (numeric, nullable) — as percentage
- primary_metric_value (numeric, nullable)
- score (numeric, nullable) — computed score used for ranking
- marked_as_winner (boolean)
- box (int[], nullable) — bounding box [ymin, xmin, ymax, xmax] 0-1000

### 3. feedback_reports
Stores AI feedback output (from /api/feedback) for a given analysis.
- id (uuid, PK)
- analysis_id (uuid, FK -> analyses.id ON DELETE CASCADE, UNIQUE)
- genre (text)
- verdict (text) — one-sentence summary
- thumbnail_scores (jsonb) — per-thumbnail scorecard
- differences (jsonb) — winner-vs-loser difference table
- genre_trends (jsonb) — genre pattern observations
- recommendations (jsonb) — next-thumbnail recommendations
- closest_benchmarks (jsonb) — top games worth studying
- created_at (timestamptz)

### 4. benchmark_games
Top Roblox games used as benchmarks for a feedback report. Child of feedback_reports.
- id (uuid, PK)
- feedback_id (uuid, FK -> feedback_reports.id ON DELETE CASCADE)
- game_name (text)
- universe_id (bigint) — Roblox universe ID
- root_place_id (bigint) — Roblox root place ID
- thumbnail_url (text, nullable)
- player_count (int) — live player count at fetch time

## Security
- All tables have RLS enabled.
- Single-tenant, no-auth app: all policies use TO anon, authenticated with USING (true) / WITH CHECK (true).
- 4 separate policies per table (SELECT, INSERT, UPDATE, DELETE).

## Notes
1. thumbnails.box uses int[] to store 4 bounding-box values.
2. Large numeric counts use bigint for values in the millions.
3. feedback_reports JSONB columns mirror the AI output schema without over-normalizing.
4. feedback_reports.analysis_id is UNIQUE — one report per analysis.
*/

CREATE TABLE IF NOT EXISTS analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_metric_name text NOT NULL,
  higher_is_better boolean NOT NULL DEFAULT true,
  experiment_name text,
  winner_index int,
  loser_index int,
  lift_percent numeric,
  notes text,
  stats_image text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_analyses" ON analyses;
CREATE POLICY "anon_select_analyses" ON analyses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_analyses" ON analyses;
CREATE POLICY "anon_insert_analyses" ON analyses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_analyses" ON analyses;
CREATE POLICY "anon_update_analyses" ON analyses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_analyses" ON analyses;
CREATE POLICY "anon_delete_analyses" ON analyses FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS thumbnails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  thumb_index int NOT NULL,
  rank int NOT NULL,
  label text NOT NULL,
  visual_description text NOT NULL DEFAULT '',
  impressions bigint,
  plays bigint,
  play_through_rate numeric,
  primary_metric_value numeric,
  score numeric,
  marked_as_winner boolean NOT NULL DEFAULT false,
  box int[]
);

ALTER TABLE thumbnails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_thumbnails" ON thumbnails;
CREATE POLICY "anon_select_thumbnails" ON thumbnails FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_thumbnails" ON thumbnails;
CREATE POLICY "anon_insert_thumbnails" ON thumbnails FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_thumbnails" ON thumbnails;
CREATE POLICY "anon_update_thumbnails" ON thumbnails FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_thumbnails" ON thumbnails;
CREATE POLICY "anon_delete_thumbnails" ON thumbnails FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL UNIQUE REFERENCES analyses(id) ON DELETE CASCADE,
  genre text NOT NULL,
  verdict text NOT NULL,
  thumbnail_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  differences jsonb NOT NULL DEFAULT '[]'::jsonb,
  genre_trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  closest_benchmarks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_feedback_reports" ON feedback_reports;
CREATE POLICY "anon_select_feedback_reports" ON feedback_reports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_feedback_reports" ON feedback_reports;
CREATE POLICY "anon_insert_feedback_reports" ON feedback_reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_feedback_reports" ON feedback_reports;
CREATE POLICY "anon_update_feedback_reports" ON feedback_reports FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_feedback_reports" ON feedback_reports;
CREATE POLICY "anon_delete_feedback_reports" ON feedback_reports FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS benchmark_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE,
  game_name text NOT NULL,
  universe_id bigint NOT NULL,
  root_place_id bigint NOT NULL,
  thumbnail_url text,
  player_count int NOT NULL DEFAULT 0
);

ALTER TABLE benchmark_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_benchmark_games" ON benchmark_games;
CREATE POLICY "anon_select_benchmark_games" ON benchmark_games FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_benchmark_games" ON benchmark_games;
CREATE POLICY "anon_insert_benchmark_games" ON benchmark_games FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_benchmark_games" ON benchmark_games;
CREATE POLICY "anon_update_benchmark_games" ON benchmark_games FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_benchmark_games" ON benchmark_games;
CREATE POLICY "anon_delete_benchmark_games" ON benchmark_games FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_thumbnails_analysis_id ON thumbnails(analysis_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_analysis_id ON feedback_reports(analysis_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_games_feedback_id ON benchmark_games(feedback_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);
