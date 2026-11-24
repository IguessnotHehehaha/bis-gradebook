-- Per-user interface preferences (colour theme and language).
-- Existing users get the defaults (light, English). Writes to app_users still go through
-- the trusted server connection; the existing RLS policies are unchanged.
CREATE TYPE "theme" AS ENUM ('light', 'dark');
CREATE TYPE "locale" AS ENUM ('en', 'ru');

ALTER TABLE "app_users"
  ADD COLUMN "theme" "theme" NOT NULL DEFAULT 'light',
  ADD COLUMN "locale" "locale" NOT NULL DEFAULT 'en';
