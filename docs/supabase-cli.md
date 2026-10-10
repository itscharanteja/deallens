# Supabase CLI setup

Demo mode needs no database. For durable server records, create or choose your Supabase Postgres project and use the bundled CLI from the repository root:

```bash
pnpm db:login
pnpm db:link --project-ref YOUR_PROJECT_REF
pnpm db:push
```

Apply both migrations: the base relational schema and `20261010010000_persist_validated_snapshots.sql`. Configure server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the backend environment. Restart and inspect `/health`; then create a thesis/import/run, restart again and confirm readback. `supabase` client construction alone is not a connectivity check.

The browser demo is bundled; there is no need to seed remote fixtures before launching it. Explicit API analyses save their selected company/evidence snapshots. Existing legacy rows without validated snapshots are reported as degraded hydration; do not silently treat them as verified data. Export legacy data before migrating an existing non-demo workspace.

For disposable local development with Docker:

```bash
pnpm db:start
pnpm db:reset
pnpm db:stop
```

`db:reset` rebuilds the local database and loads the seed. Do not reset a remote database as a deployment step. Put all future schema changes in committed migration files and review them before `db:push`. See [deployment.md](deployment.md) for hosting configuration and acceptance checks.
