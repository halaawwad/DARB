# DARB backend final handoff — 2026-11-03

## Readiness decision

The implemented backend is ready for a reviewed GitHub **development foundation**
handoff. Build and regression checks pass and npm reports no known dependency
vulnerabilities. This is not a completed production/data-integrity sign-off:
one historical fictional incident is still cross-tenant, and its ownership
constraint remains `NOT VALID` pending an explicit owner decision. Future
finance/delivery/offline modules still need the broader schema work described in
the earlier audit.

No commit or push was performed. No other Docker project, Expo source/config,
database volume, or existing business record was changed/deleted. Only DARB's
backend container was rebuilt/recreated. Existing business roles were not
automatically given permissions.

## Dependency audit and targeted updates

Both of these executed inside the rebuilt backend and exited 0:

```powershell
docker compose -p darb exec -T backend npm audit --json
docker compose -p darb exec -T backend npm audit --omit=dev --json
```

Both returned an empty vulnerabilities object and totals of **0 critical, 0 high,
0 moderate, 0 low**. The initial report contained 13 vulnerable package entries:
2 critical, 5 high, 6 moderate. Several were propagated entries in the same
dependency chain rather than independent exploits.

| Original package/chain | Original severity | Exposure assessment and fix |
|---|---|---|
| `vitest@2.1.9` | Critical | UI/API server file-read/execution advisory. DARB uses CLI test runs, not a public Vitest UI; still upgraded to patched `4.1.12`. |
| `vitest → tinypool@1.1.1` | Critical | Worker-options prototype-pollution/RCE conditions; untrusted worker options are not accepted by DARB. Removed from the resolved tree by the Vitest update. |
| `vitest → @vitest/mocker@2.1.9` | Moderate | Development-server mock registration/path handling. Updated to `4.1.12`. |
| `vitest → vite-node@2.1.9` | Moderate | Propagated Vite findings; no longer in the resolved tree. |
| `vitest → vite@5.4.21` | High | Development-server path/editor/cross-origin issues; no production API route to that server. Constrained to patched `6.4.5`, a supported Vitest 4 dependency, instead of an unnecessary Vite 8 jump. |
| `vite → esbuild@0.21.5` | Moderate | Cross-origin development-server exposure. The vulnerable version was removed with the Vite update. |
| `zod@3.25.76` | High | Oversized constrained-collection validation can exhaust memory. API validation is reachable by clients, though JSON size and authentication limit exposure. Upgraded to patched `4.6.7`, using v4 imports rather than the legacy v3 compatibility entry point. |
| `prisma@6.19.3 → @prisma/config@6.19.3 → deepmerge-ts@7.1.5` | High for all three entries | Recursive-object stack exhaustion in config merging, not a DARB HTTP input path. Kept Prisma/client at `6.19.3` and scoped an exact `deepmerge-ts@8.0.2` override to `@prisma/config`. |
| `swagger-jsdoc@6.3.0 → glob@11.1.0 → minimatch@10.2.6` | Moderate for all three entries | Filesystem traversal/pattern amplification. The Swagger generator was unused after the explicit OpenAPI contract was added; removed it and its unused type dependency instead of updating unused runtime code. |

Only the needed Zod/Vitest security major updates were made. No Prisma major,
Node major, framework rewrite, blanket upgrade, or forced audit fix was used.
The backend manifest/lockfile and both Docker/host backend dependencies were
updated; root Expo dependencies were untouched.

The scoped deepmerge override is a deliberate compatibility decision. Version 8
changes Map-value merging and custom type APIs; DARB uses neither. Unit tests
execute the exact module resolved through `@prisma/config`, verify ordinary
Prisma-style config merges and circular graph handling, and Prisma generation/
validation/status succeeded. Review/remove the override when upgrading Prisma to
an upstream version that directly supplies the patched dependency.

Primary references:
[Vitest 4 migration](https://v4.vitest.dev/guide/migration.html),
[Zod migration](https://zod.dev/v4/changelog),
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[deepmerge 8 release](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0).
There are **no remaining npm-reported vulnerable packages** in this lockfile at
the time of verification. Future audits may change as new advisories are issued.

## Permission provisioning

The matrix in [SECURITY.md](SECURITY.md) matches the default policy. Manager/admin
has the reviewed manager grants; sales, delivery, accountant and warehouse roles
have their specific restricted sets. JWT role claims never supply grants.

The real integration suite invoked `prisma/provision-permissions.ts` twice for
one newly created fictional tenant. Role, permission, grant and membership counts
were unchanged after each repeat; another tenant was unchanged. The suite checked
every default role's exact grant set and rejected both foreign-company roles and
foreign-company permission grants through actual requests. Zero-permission users
remained denied. Deliberate revocation also took effect on an existing token.

```powershell
docker compose -p darb exec -T backend npm run permissions:provision -- --company-id <company-UUID>
```

This is explicit, tenant-specific, idempotent and additive. It does not assign
roles to users or clean up custom grants. Existing zero-grant roles were left
restricted; provision only the intended company after reviewing its memberships.
No broad grant migration/startup hook was introduced.

The optional development seed now requires a private `DARB_SEED_PASSWORD` of at
least 16 characters. The previously hardcoded seed password was removed. The
seed was not executed as part of this handoff and existing passwords were not
changed.

## Historical database constraint

The preserved incident is `15ad8a1f-644a-4ddf-b05a-8f44bf9a0224`, owned by company
`b9e79bc3-b119-4b44-9b8d-f2cff02c64e7`. It references checkpoint
`75e0d93e-8281-4f71-b9e4-16867278a392`, owned by company
`6f6f2db3-52b2-4719-ace7-5146d24f3231`.

The composite FK `road_incidents_company_checkpoint_fk` remains unvalidated.
Its new-write enforcement passed an independent real PostgreSQL regression test.
No historical row was cleared, deleted or reassigned. No new migration was needed
in this remediation; the two existing migrations remain unchanged.

Options and the exact manual validation procedure are in [SECURITY.md](SECURITY.md).
The guarded script is `scripts/validate-checkpoint-ownership.sql`; it performs no
business-record edits and aborts while any ownership violations remain. It was
not run against the known-invalid database. Owner approval is required before
any data repair; full historical validation is the remaining local database item.

## Executed tests and service checks

| Check | Result |
|---|---|
| Docker image `npm ci` and backend startup | Passed; backend recreated and healthy |
| `npm run build` | Passed |
| `npm test` | **27 passed**, 4 unit test files; explicit mocks |
| Real Docker `npm run test:integration` | **40 passed**, real PostgreSQL/PostGIS/Redis and HTTP/Socket.IO |
| Full and production-only npm audit | **0 vulnerabilities**, both exit 0 |
| Swagger | **15 paths**, bearer authentication, relative server `/` |
| Prisma schema/migrations | Valid schema; both applied migrations up to date |
| Compose configuration and service health | Passed; all three DARB services healthy |
| Host Windows tooling | TypeScript check and **27 unit tests passed** |
| Expo files | **104 source/config files hash-compared; zero changes** |

The Windows test runner emits a non-blocking warning about the parent Expo
`tsconfig.base` dependency. Backend checks pass; no frontend dependency/config
changes were made to suppress that pre-existing warning. Docker tests emit no
such warning. A frontend build was not part of this backend validation.

Integration run: `integration-mw170zrr-9aeb76bb`. Its companies were
`d95134c8-666d-46ed-b44c-8d163207eeab` and
`8b1775fb-8f49-4351-bb7f-cd57b5daa0af`. Fictional fixtures were retained and
their eight users disabled by teardown. Redis keys expire. Intentional invalid
role-grant fixtures stay confined to these disabled test tenants.

Tests include all five earlier security regressions plus provisioning idempotency,
the complete default permission matrix, actual SQL ownership enforcement,
cross-tenant event delivery, inactive users/companies, revocation, CRUD/order
persistence, spatial queries, and real Redis NX/TTL semantics. Patched dependency
tests verify bounded oversized-array rejection and safe circular config merging.

Reproduction commands and fresh-checkout instructions: [README.md](README.md).
The root README now distinguishes the independently runnable backend from the
unchanged mocked mobile app.

## Files changed in this final remediation

- `server/package.json`, `server/package-lock.json`: targeted dependency updates,
  removal of unused Swagger generator, scoped security overrides.
- `server/prisma/provision-permissions.ts`: strict UUID input validation.
- `server/prisma/seed.ts`: private environment-supplied development seed password.
- `server/tests/integration/backend.test.ts`: three provisioning/matrix/tenant
  regressions, increasing real tests from 37 to 40.
- `server/tests/unit/dependency-security.test.ts`: three dependency regressions,
  increasing unit tests from 24 to 27.
- `server/scripts/validate-checkpoint-ownership.sql`: guarded manual validation.
- `server/SECURITY.md`: approved-remediation options and validation procedure.
- `server/README.md`, root `README.md`: teammate setup and backend status.
- `server/INTEGRATION-REPORT.md`: labels the earlier results as historical.
- `server/HANDOFF.md`: this report.

`.gitignore`, Docker Compose settings, applied migrations and the Expo source/
configuration were not changed. Private `.env` files are ignored and untracked;
Git history contains neither root nor server `.env`. A scan of Git-tracked and
Git-eligible files found no current private environment values, literal signed
JWTs or private key blocks. Explicit fictional unit-test secrets are not runtime
credentials. The image contains no `/app/.env`.

## Outstanding items

1. Obtain the owner's decision about the one historical incident, then perform
   the guarded validation procedure. Do not treat `NOT VALID` as fully checked.
2. Provision intended business/development roles explicitly when choosing actual
   users/companies; zero-grant denial is intentional, not an authentication bug.
3. Complete separate schema/API design for future modules before claiming those
   modules or the entire platform are production-ready.

These conditions are disclosed rather than hidden by a successful dependency
audit. No destructive reset, volume deletion, unrelated Docker change, commit or
push is required for this handoff.
