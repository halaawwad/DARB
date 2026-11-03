# DARB verified security fixes — 2026-11-03

This is the historical first-fix snapshot. Dependency remediation, expanded tests,
and current handoff status are recorded in [HANDOFF.md](HANDOFF.md).

## Executed validation

| Check | Result |
|---|---|
| Prisma schema validation and client generation | Passed |
| `npm run build` in the rebuilt backend container | Passed |
| `npm test` in Docker | 24 unit tests passed across 3 files |
| Explicit real-service integration command in SECURITY.md | 37 tests passed |
| `prisma migrate status` | Both migrations applied; database up to date |
| `docker compose -p darb config --quiet` | Passed |
| Host `/ready` on port 3001 | PostgreSQL and Redis reported available |
| Host `/openapi.json` | 15 paths; bearer scheme; relative server `/` |
| Final service health | Backend, PostgreSQL and Redis healthy |
| Frontend tracked-file diff | Empty; no frontend edits in this task |

Earlier local unit failures came from an ungenerated Windows Prisma client. After
generating that client, all local unit tests passed. A subsequent TypeScript check
exposed Express parameter union types; route IDs now undergo UUID validation.
The final Docker build, unit run and integration run all passed after those fixes.

The real integration run was `integration-mw16d87j-caae87ee`, with company IDs
`32953053-6e2f-41a5-9dd1-5fa219dcecff` and
`579e5d27-654b-47ab-8092-99974f097248`. Its fictional records are retained, and
all eight test users were disabled by suite teardown. Expiring Redis keys were
used. No existing business records were deleted.

## Verified security outcomes

- Company A's actual order event reached A and did not reach B. Foreign room
  joins failed. Unauthenticated, expired, forged and zero-grant sockets failed.
- Cross-company incidents failed through HTTP and through a direct Prisma write
  exercising the real PostgreSQL composite FK.
- Warehouse, sales, delivery, accountant and zero-grant users could not write the
  product catalogue. Zero-grant users were denied all resource groups. Sales
  balance changes and customer deletion were denied. Grant revocation took effect
  on an existing JWT. Unit tests also reject foreign-company role/grant data.
- Inactive users and companies failed login, authenticated HTTP and socket
  handshakes. A user disabled after connecting received no later order event and
  was disconnected before delivery.
- Foreign products returned a safe 400. Mixed valid/invalid item requests produced
  neither partial orders nor partial items. An allowed two-item order persisted
  with an exact total of 40.75.
- Customer/product CRUD, two-tenant reads/lists, JWT checks, real PostGIS radius
  queries, and real Redis NX/GET/TTL checks passed.

## Migration and preserved data

Applied `20261103010000_checkpoint_tenant_integrity`; the initial migration was
not edited. The new migration adds checkpoint indexes and a composite ownership
FK, replacing the single-column FK. Its `NOT VALID` status preserves incident
`15ad8a1f-644a-4ddf-b05a-8f44bf9a0224` and prevents new invalid references.
Post-migration inspection confirmed that historical violation still exists.
Full historical constraint validation requires explicit remediation approval and
a later reviewed migration. No cleanup was performed automatically.

## Files changed in this task

All paths below are relative to `server/`:

- Startup/configuration: `src/app.ts` (new), `src/index.ts`, `src/config/env.ts`.
- Authentication/authorization: `src/middleware/auth.ts`,
  `src/features/auth/authService.ts`, `src/features/auth/permissions.ts` (new),
  `src/lib/jwt.ts`, `src/lib/socket.ts`.
- Service/error handling: `src/lib/prisma.ts`, `src/lib/redis.ts`,
  `src/lib/errors.ts`.
- Routes: `src/routes/auth.ts`, `src/routes/companies.ts`,
  `src/routes/customers.ts`, `src/routes/products.ts`, `src/routes/orders.ts`,
  `src/routes/checkpoints.ts`.
- Documentation contract: `src/openapi.ts` (new).
- Database/provisioning: `prisma/schema.prisma`, `prisma/seed.ts`,
  `prisma/provision-permissions.ts` (new),
  `prisma/migrations/20261103010000_checkpoint_tenant_integrity/migration.sql` (new).
- Test configuration/scripts: `package.json`, `vitest.config.ts`,
  `vitest.integration.config.ts` (new).
- Tests: `tests/unit/security.test.ts`, `tests/unit/openapi.test.ts`,
  `tests/unit/startup.test.ts`, `tests/integration/backend.test.ts` (all new).
  The old top-level `auth`, `business`, `gis`, `health`, `socket` and `tenant`
  `.test.ts` files were replaced by explicit unit and real-service coverage.
- Handoff guidance: `.env.example`, `DOCKER.md`, `SECURITY.md` (new),
  `INTEGRATION-REPORT.md` (new).

No dependency versions, lockfiles, frontend files, Compose settings, or other
Docker projects were changed. Only DARB's backend container was rebuilt and
recreated; database/Redis containers and volumes were preserved. No commit/push.

## Remaining handoff conditions

1. The existing lockfile has 13 npm advisory entries: 2 critical, 5 high and 6
   moderate. The critical entries are in Vitest/Tinypool; high entries also
   include Prisma's configuration dependencies and Zod. `npm audit --json` was
   executed and exited 1. Exposure was not fully assessed; no forced major
   dependency upgrades were mixed into this targeted change.
2. Existing zero-grant business roles intentionally remain denied. An owner must
   explicitly provision the reviewed baseline and review role memberships. The
   migration and startup grant no access automatically.
3. The historical invalid audit relationship remains pending remediation and
   full FK validation.
4. Broader financial/delivery/offline schema gaps from the earlier database audit
   are not resolved by this checkpoint-focused migration. Unimplemented modules
   are not advertised as working API endpoints.

All five reproduced integration bugs are fixed and regression-tested. The
implemented API is suitable for a reviewed development handoff with these
conditions disclosed; an unconditional security/production readiness claim is
not supported while dependency advisories and the historical data issue remain.
