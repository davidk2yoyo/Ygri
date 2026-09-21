# Supabase migrations

Every `.sql` file that must be run manually in the Supabase SQL editor lives here, named `YYYY-MM-DD_<original-name>.sql` — the date is when that file was first added to the repo (from git history, not filesystem mtime), so a plain `ls` sorts everything in the order it was actually written and run.

They are **not** run automatically by any build or deploy step — Claude has no direct write access to this project's Supabase database, so after any change that adds or edits a file here, it still needs to be run by hand in the Supabase SQL editor. All of them are additive/idempotent (`CREATE TABLE IF NOT EXISTS`, `INSERT ... WHERE NOT EXISTS`, etc.) and safe to re-run.

New migrations go directly in this folder with today's date prefixed, following the same naming convention.
