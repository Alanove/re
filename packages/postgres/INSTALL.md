# Installing the postgres connector

Step by step for adding `@local/postgres` to an app. Paths below are relative to that app folder unless they start with `packages/`.

## 1. Build the module into the app

Add this script to the app's `package.json`:

```json
"postgres:build": "node ../../packages/postgres/build.mjs --out src/vendor/postgres"
```

From the app folder:

```bash
cd packages/postgres && npm install && cd -
npm run postgres:build
```

It writes `src/vendor/postgres/createPostgres.ts`. Commit that file. Never edit it by hand; change the package and rebuild.

Add `pg` and `zod` to the app's dependencies if they are not already there, plus `@types/pg` in devDependencies.

## 2. Wire a thin app adapter

Keep env parsing in the app. Map fields into `createPostgres`:

```ts
import { createPostgres } from '../vendor/postgres/createPostgres.js';
import { env } from '../config/env.js';

export const postgres = createPostgres(
  env.DATABASE_URL.trim()
    ? {
        connectionString: env.DATABASE_URL,
        ssl: env.NODE_ENV === 'production',
        max: 10
      }
    : null
);
```

Call `postgres.isConfigured()` before `query` or `check`. Catch `PostgresError` and return a clear error. Do not log the connection string or password.

## 3. Switching the family-finance app from SQLite to Postgres

The finance app starts on Prisma + SQLite. When you move it:

1. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.
2. Point `DATABASE_URL` at a Postgres instance (local Docker, Neon, or Supabase).
3. Run a fresh Prisma migration against that database.
4. Optionally vendor-copy this package if you need raw SQL beside Prisma. The app does not import `@local/postgres` until that day.

Money stays in integer minor units and calendar dates stay as `YYYY-MM-DD` strings, so the schema shape does not need a rewrite for the provider change.
