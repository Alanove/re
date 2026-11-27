# @local/postgres

Shared PostgreSQL connector. Config is passed in; the package never reads `process.env`.

```ts
import { createPostgres } from './vendor/postgres/createPostgres.js';

const db = createPostgres({
  connectionString: env.DATABASE_URL,
  ssl: true,
  max: 10
});

// or host parts:
const db = createPostgres({
  host: env.PGHOST,
  port: 5432,
  user: env.PGUSER,
  password: env.PGPASSWORD,
  database: env.PGDATABASE
});

if (db.isConfigured()) {
  await db.check();
  const { rows } = await db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    email
  ]);
  await db.close();
}
```

Queries always take parameters as a separate array. Failures throw `PostgresError`.

```bash
npm install
npm run check
npm test
npm run build
```

To put the module on an app, see [INSTALL.md](INSTALL.md).
