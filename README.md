# Jainam Creation

A web app replacing the handwritten embroidery job-work register with a
digital one. Single owner user. Built with Next.js (App Router) + Neon
Postgres + Drizzle ORM + Auth.js v5 (Credentials, username/password only),
deployed on Vercel.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — Neon **pooled** connection string (hostname contains
     `-pooler`), provisioned directly at neon.com.
   - `AUTH_SECRET` — generate with `openssl rand -base64 32`.
3. `npm run db:migrate`
4. `npm run user:create -- <username> <password>` — this is how the
   owner's account is created. **There is no signup page, by design** (an
   unauthenticated signup route would be a permanent security hole for an
   app that will only ever have one user).
5. `npm run dev`

## Creating or resetting the owner's password (lockout recovery)

There is no email on this account, so there is no self-service "forgot
password" flow. The recovery path is a script run directly against the
database:

```
npm run user:reset-password -- <username> <newPassword>
```

Notes:
- Requires `DATABASE_URL` in `.env.local`. If you're recovering production
  access from a machine that doesn't have it, run `vercel env pull` first
  to fetch the production values into a local `.env.local`.
- This script talks to the same database the live app uses, so the new
  password works immediately on the next login — no deploy needed.
- If the username doesn't match any existing user, the script exits with
  an error and makes no change (it will not silently "succeed" on a typo).

The same script, run again with the current username and a new password,
also works as an ordinary password change if you're locked out of the
in-app settings page for any reason.

## Scripts

| Script | Command | What it does |
|---|---|---|
| Dev server | `npm run dev` | Starts Next.js in development mode |
| Build | `npm run build` | Production build |
| Lint | `npm run lint` | Runs ESLint (`next lint` was removed in Next.js 16) |
| Generate migration | `npm run db:generate` | Diffs `src/lib/db/schema.ts` against the last migration, writes a new SQL file under `drizzle/` |
| Apply migrations | `npm run db:migrate` | Applies pending migrations in `drizzle/` to `DATABASE_URL` |
| DB smoke test | `npm run db:smoke` | Verifies the Drizzle client can connect to Neon |
| Create owner account | `npm run user:create -- <username> <password>` | Idempotent — safe to re-run, never duplicates or overwrites an existing user |
| Reset password | `npm run user:reset-password -- <username> <newPassword>` | AUTH-07 lockout recovery path — see above |

## Data access rule

All business-data queries (parties, karigars, particulars, job works) go
through `src/lib/db/repositories/*`, never the raw Drizzle client or
schema directly. See [`docs/DATA-ACCESS.md`](./docs/DATA-ACCESS.md) for
why and how this is enforced.
