# Backend security and integration contract

All protected resource endpoints require an active database user, an active
company, and the documented permission. JWT role/email claims never authorize an
operation. Every HTTP request resolves current grants from PostgreSQL. Grants
through another company's role or permission are ignored; explicitly global
permissions may be assigned through a same-company role.

## Reviewed permission matrix

| Capability | Manager (`manager` / existing `admin`) | Sales | Delivery | Accountant | Warehouse |
|---|---|---|---|---|---|
| Current company | Yes | Yes | Yes | Yes | Yes |
| Read customers | Yes | Yes | Yes | Yes | No |
| Create/update customer details | Yes | Yes | No | No | No |
| Delete customers / change opening balance | Yes | No | No | No | No |
| Read products/orders | Yes | Yes | Yes | Yes | Yes |
| Create/update/delete product catalogue | Yes | No | No | No | No |
| Create orders | Yes | Yes | No | No | No |
| Read nearby checkpoints / submit incidents | Yes | Yes | Yes | No | No |

Warehouse stock operations and accountant posting operations have no endpoints
yet and confer no catalogue/customer write access. `/auth/me` requires active
authentication but no resource grant. Health, readiness, documentation and login
are public. Manager access also requires actual grants, never only a role name.

Permission keys and the provisioning policy are in
`src/features/auth/permissions.ts`. New and existing zero-grant roles remain
denied until provisioned explicitly. To add the reviewed baseline to a chosen
company (including manager/admin roles), use:

```powershell
docker compose -p darb exec -T backend npm run permissions:provision -- --company-id <company-UUID>
```

This is additive: it preserves existing custom grants and role memberships.
It does not assign manager roles to users. Review existing custom grants
separately; running provisioning does not revoke overbroad historical grants.
The optional development seed provisions only its explicitly named demo tenants.
Startup and schema migrations never grant permissions.

Login remains email/password compatible when email identifies one company. If an
email exists in multiple companies, login requires `companySlug`; otherwise it
fails with the same generic 401 used for invalid credentials. Inactive users and
companies are rejected at login and on subsequent HTTP/socket authentication.

## Socket.IO

Connections require an active user with `orders:read`. The server joins only
`company:<authenticated-company-UUID>`. Client room requests must match that UUID;
legacy demo aliases have been removed. Room joins acknowledge through
`company-room-joined`, never a fabricated `order-created` event.

Order events use the trusted request company. Active state, JWT expiry and current
grants are rechecked before event delivery, including for already-connected users,
and before processing incoming events. Revoked clients are disconnected. The
current implementation is a single backend instance; adding replicas requires
shared Socket.IO adapter configuration and equivalent revocation checks.

## Checkpoint ownership migration

`20261103010000_checkpoint_tenant_integrity` adds the unique checkpoint tenant/ID
key, the missing tenant index, and a composite incident-to-checkpoint foreign key.
The former single-column FK is replaced. Referenced checkpoints now use `NO
ACTION` deletion rather than automatically clearing incident references; no
checkpoint deletion endpoint currently exists.

The composite FK is intentionally `NOT VALID`: PostgreSQL enforces new or changed
references without modifying historical violations. Before this migration the
audit found incident `15ad8a1f-644a-4ddf-b05a-8f44bf9a0224`, company
`b9e79bc3-b119-4b44-9b8d-f2cff02c64e7`, referencing checkpoint
`75e0d93e-8281-4f71-b9e4-16867278a392` in company
`6f6f2db3-52b2-4719-ace7-5146d24f3231`. It is not deleted or reassigned.

After explicit owner-approved remediation, a separate reviewed migration can
validate the constraint. Do not edit the original migration, reset data, or run
schema push to bypass this process. Other relationships identified in the earlier
database audit are outside this focused migration and still need review before
implementing finance/delivery/offline-sync modules.

### Historical remediation options (owner approval required)

The incident is a known fictional audit fixture, but its records are still
preserved. Safe choices depend on the original event's intended ownership:

1. Clear only the optional checkpoint reference, retaining the incident and its
   coordinates/company, if no legitimate checkpoint association was intended.
2. Repoint it to a verified checkpoint in the incident's own company, if that
   accurately describes the original report.
3. Correct incident company ownership only if the owner establishes that the
   incident itself belongs to the other company; review all related data first.
4. Leave the record unchanged pending that decision. The FK continues enforcing
   new/changed references while historical validation remains outstanding.

No option is executed automatically. Deletion is unnecessary. Before any repair,
record the old IDs, authorize the precise change, and use a narrowly targeted
transaction with an audit trail. Do not drop the ownership constraint to make a
write succeed.

Read-only precheck in PostgreSQL:

```sql
SELECT i.id, i."companyId" AS incident_company, i."checkpointId",
       c."companyId" AS checkpoint_company
FROM public.road_incidents i
LEFT JOIN public.checkpoints c ON c.id = i."checkpointId"
WHERE i."checkpointId" IS NOT NULL
  AND (c.id IS NULL OR c."companyId" <> i."companyId");
```

Only after approved remediation and a zero-row precheck, run this manually from
the repository root against DARB. It does not edit business records; its guard
aborts if any violations remain. Lock/statement timeouts bound the operation.

```powershell
Get-Content -Raw server/scripts/validate-checkpoint-ownership.sql |
    docker compose -p darb exec -T postgres psql -X -U darb -d darb -v ON_ERROR_STOP=1
```

The script runs `ALTER TABLE public.road_incidents VALIDATE CONSTRAINT
road_incidents_company_checkpoint_fk` inside a transaction. Confirm completion:

```sql
SELECT conname, convalidated FROM pg_constraint
WHERE conname = 'road_incidents_company_checkpoint_fk';
```

Require `convalidated = true`. On a shared deployment, retain the validation as a
new reviewed migration after remediation; never rewrite the applied migrations.
A fresh database with a zero-row precheck needs no data repair before validation.

## API and tests

Swagger UI is `/docs/`; the complete implemented OpenAPI contract is
`/openapi.json`, with a relative server URL and bearer authentication. Unsupported
future modules are not advertised. Invalid/foreign/inactive order products return
400 before nested atomic order/item creation. Missing/foreign checkpoints return
404/403. Request validation returns 400 and unexpected errors expose no internals.

```powershell
docker compose -p darb exec -T backend npm run prisma:deploy
docker compose -p darb exec -T backend npm run prisma:generate
docker compose -p darb exec -T backend npm run build
docker compose -p darb exec -T backend npm test
docker compose -p darb exec -T -e DARB_INTEGRATION=1 -e DARB_API_URL=http://127.0.0.1:3000 backend npm run test:integration
```

`npm test` runs only explicit mocked unit tests. Importing the app or entry module
does not start a listener. Real tests call the running API, use actual Prisma and
Redis clients, and require the explicit flag, URL, DATABASE_URL, REDIS_URL and
JWT_SECRET. Run them in development mode. There are no runtime test-mode database
or Redis fallbacks. An unavailable dependency or missing configuration fails the
integration run rather than substituting mocks.

Each integration run creates random fictional tenants and users, provisions only
those tenants, and checks actual HTTP, sockets, SQL constraints, PostGIS and Redis
NX/TTL behavior. Fixtures are retained for inspection; their users are disabled
after the run. No business records are deleted. Test Redis keys expire. Do not
point integration tests at production data or another Docker project.
