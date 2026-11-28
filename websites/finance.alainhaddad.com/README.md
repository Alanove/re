# Family Finance (`finance.alainhaddad.com`)

Household money and freelance work. Next.js App Router, Prisma + MySQL, Better Auth.

## Quick start

```bash
cd websites/finance.alainhaddad.com
npm install
npx prisma migrate deploy
npm run db:import-sqlite   # one-time: copy prisma/dev.db into MySQL
npm run dev
```

Open [http://localhost:3100](http://localhost:3100).

## Scripts

- `npm run dev` — local app (port 3100)
- `npm run typecheck` / `npm run lint` / `npm run build` — gates
- `npm test` — unit tests
- `npm run db:studio` — Prisma Studio
- `npm run db:migrate` — create/apply migrations in development
- `npm run db:migrate:deploy` — apply migrations (production / deploy)
- `npm run db:import-sqlite` — one-shot SQLite → MySQL data copy

## Database

MySQL via `DATABASE_URL` in `.env` / `.env.production`. Deploy uses `DB_*` for mysqldump backups.

## Deploy

```powershell
.\scripts\deploy\deploy.ps1 -Site finance.alainhaddad.com
```
