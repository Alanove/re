# Family Finance

Household money and freelance work. Next.js App Router, Prisma + SQLite for local development, Better Auth.

## Quick start

```bash
cd apps/family-finance
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first signup creates the household and an owner.

## Scripts

- `npm run dev` — local app
- `npm run typecheck` / `npm run lint` / `npm run build` — gates
- `npm test` — Left / Owed / forecast unit tests
- `npm run db:studio` — Prisma Studio

## Database

Local: SQLite via `DATABASE_URL=file:./dev.db` in `.env`.

Later Postgres: change the Prisma provider, point `DATABASE_URL` at Postgres, migrate. A shared connector lives in `packages/postgres` (`@local/postgres`) and is not wired into this app yet.

## Layout

- `prisma/schema.prisma` — household-scoped models
- `src/lib/money.ts` — Left, Owed, headline, forecast sentence
- `src/lib/auth.ts` — Better Auth + first-signup household
- `src/app/(app)/` — Home, Activity, Plan, Work, Reports, Settings
