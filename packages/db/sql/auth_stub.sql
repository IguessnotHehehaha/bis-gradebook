-- Makes a plain PostgreSQL database understand the Supabase pieces our policies use:
-- the roles `anon` / `authenticated` and the function auth.uid().
-- It does NOTHING on a real Supabase database (they already exist there).
-- Used by: the backup database, local Docker databases and Prisma's shadow database.
-- The same block is repeated inside the roles_and_rls migration.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    EXECUTE $f$
      CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $body$
        SELECT coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        )::uuid
      $body$
    $f$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  END IF;
END
$$;
