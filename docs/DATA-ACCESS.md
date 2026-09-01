# Data Access Contract

## Why

A forgotten `WHERE userId = ?` is the classic multi-tenant data leak — one
user reading or mutating another user's rows. Discipline ("I'll remember to
filter by userId") is not a control; it is a hope. This project makes the
leak structurally impossible to introduce by accident, using a mechanism
the compiler and the linter both enforce, not just code review.

## The Rule

Only files under `src/lib/db/repositories/*` may import the raw Drizzle
client (`@/lib/db/client`) or the schema (`@/lib/db/schema`). Everywhere
else — Server Actions, Route Handlers, React Server Components, scripts
outside `scripts/**` — must call a repository function instead.

This is enforced by a `no-restricted-imports` ESLint rule in
`eslint.config.mjs`, which bans both import paths project-wide and is only
turned back off for `src/lib/db/repositories/**`, `scripts/**`, and
`drizzle.config.ts` (developer scripts and drizzle-kit legitimately talk to
the database directly and never run inside the app). This is proven to fire
in `.planning/phases/01-foundation-auth/01-02-SUMMARY.md`: a deliberate
violating import was added to a file under `src/app/`, `npm run lint`
errored with the custom message, then the import was removed and lint
passed again.

## The Signature Convention

Every repository function that touches business data (parties,
silaiKarigars, descriptionTypes, jobWorks, jobWorkDescriptions) takes `userId:
string` as its **mandatory first parameter**. There is no overload without
it — TypeScript's arity checking is the compile-time enforcement. Every
query filters on it via `and(eq(table.userId, userId), ...)`.

Deletes and updates use `.where(and(eq(t.id, id), eq(t.userId, userId)))`
so that a mismatched userId matches **zero rows** rather than throwing or,
worse, touching another user's row.

The `users` table is the one exception: it IS the scoping root, so its
repository (`src/lib/db/repositories/users.ts`) is keyed by username or
user id directly, not by a userId filter.

## How userId Is Obtained

`userId` is only ever obtained from `getCurrentUserId()` (built in plan
01-03, `src/lib/session.ts`), which reads it off the authenticated session.
It must never come from a form field, a URL param, or any other
client-supplied value — a form or URL param is trivially forgeable by the
one browser user this app has today, but the contract exists so that
remains true even if the app ever grows more users.

## Why Prisma's `scopedDb()` Was Not Ported

ARCHITECTURE.md's original scoping mechanism (`scopedDb()`) was written
against Prisma's Client Extensions, which can intercept arbitrary query
calls and silently inject a `where` clause. Drizzle has no equivalent
query-middleware/extension point — a runtime-injecting wrapper around
Drizzle's query builder is not realistically buildable without
re-implementing a meaningful chunk of the query builder itself. The
repository-module-plus-ESLint-rule pattern documented here is the verifiable
equivalent: the function signature is the compile-time contract, and the
lint rule is the static-analysis guarantee that nothing bypasses it.

## Deferred Alternative: Postgres RLS

Row-Level Security was evaluated and deliberately deferred, not rejected
forever. Plain Neon + Drizzle has no built-in bridge from "authenticated
user" to a Postgres session variable the way Supabase does — it would
require hand-building `SET ROLE`/`current_setting()` plumbing per request,
which is a real correctness hazard on a pooled, connection-reused serverless
driver (a pooled connection could serve request A's `SET ROLE`, then get
reused for request B without resetting it, unless done with extreme care
per-transaction). This is unjustified complexity for a single-user app.
Revisit only if the app ever becomes genuinely multi-user.

## Note for Phase 2+: `updatedAt` Does Not Auto-Bump

Unlike Prisma's `@updatedAt`, Drizzle's `.defaultNow()` only sets the value
on **insert** — it does not automatically bump on `UPDATE`. Every
`update*` repository function added from Phase 2 onward must explicitly set
`updatedAt: new Date()` in its `.set()` call, or a row's `updatedAt` will
silently equal its `createdAt` forever after real edits.
