-- Allow challenges to be read by the app (Drizzle uses direct Postgres connection with no auth context)
-- Run this in Supabase Dashboard → SQL Editor

DROP POLICY IF EXISTS "Challenges are viewable by authenticated users" ON challenges;

CREATE POLICY "Challenges are publicly readable"
  ON challenges
  FOR SELECT
  USING (true);
