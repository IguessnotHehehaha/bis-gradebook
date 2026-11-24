# Database backup

 created a PostgreSQL backup of the local gradebook database. (by temrkz :3)

- Backup file: `backups/gradebook_2026-11-24T08-02-02-441Z.dump`
- Created with `pg_dump` inside the running Docker database container.
- The dump file is kept outside Git because it may contain database records.
