-- Supabase exposes every public table through its REST API. The blog connects with a direct Postgres
-- role (which bypasses RLS), so enabling RLS with no policies closes that API route without affecting the app.
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
