# DARB backend foundation

This backend runs independently of the Expo app. The mobile application still
uses its existing mock services; no frontend files or integration switches are
changed by this handoff.

Use Docker Desktop's Linux engine and Docker Compose. The image provides the
supported Node.js 20 runtime, so a local Node installation is optional. For local
backend tooling, use Node 20.19+ or a supported newer LTS release.

## First checkout

From the repository root, copy `.env.example` to `.env` only if `.env` does not
already exist. Replace POSTGRES_PASSWORD and JWT_SECRET with private random
values. Use a URL-safe database password and a JWT secret of at least 32
characters. Never commit the populated file. Docker uses this root file, not
`server/.env`.

Follow the port check and startup commands in [DOCKER.md](DOCKER.md). The expected
ports are API `3001`, host-loopback PostgreSQL `5434`, and host-loopback Redis
`6380`. Internal service URLs remain `postgres:5432` and `redis:6379`.

```powershell
docker compose -p darb config --quiet
docker compose -p darb up -d --build --wait --wait-timeout 180
docker compose -p darb ps
Invoke-RestMethod http://localhost:3001/ready
```

Do not stop another project to free ports. On an existing DARB stack, only rebuild
its backend after dependency/test changes:

```powershell
docker compose -p darb up -d --build --no-deps --wait --wait-timeout 180 backend
```

Startup generates Prisma's client and deploys committed migrations. It does not
seed users, reset data, or grant permissions. A fresh database initially has no
login accounts. For one stable fictional manager account to try Swagger, use the
development-only Windows command in [SWAGGER-LOGIN.md](SWAGGER-LOGIN.md); it stores
the password locally with Windows encryption and verifies the actual HTTP login.
Company/user setup is an explicit administrative step. For the
optional fictional development seed, set a private `DARB_SEED_PASSWORD` of at
least 16 characters in your shell and pass it to
`docker compose -p darb exec -T -e DARB_SEED_PASSWORD backend npm run db:seed`.
Do not run the demo seed against business data. Existing users' passwords are
not automatically rotated by an upsert.

To provision the reviewed default grants for one explicitly selected development
company, use:

```powershell
docker compose -p darb exec -T backend npm run permissions:provision -- --company-id <company-UUID>
```

This command is idempotent and additive. It does not assign users to roles or
grant every user manager access. Zero-grant roles stay restricted unless their
company/role is deliberately provisioned. See the matrix in
[SECURITY.md](SECURITY.md).

## Validate a handoff

```powershell
docker compose -p darb exec -T backend npm audit
docker compose -p darb exec -T backend npm audit --omit=dev
docker compose -p darb exec -T backend npx --no-install prisma validate
docker compose -p darb exec -T backend npx --no-install prisma migrate status
docker compose -p darb exec -T backend npm run build
docker compose -p darb exec -T backend npm test
docker compose -p darb exec -T -e DARB_INTEGRATION=1 -e DARB_API_URL=http://127.0.0.1:3000 backend npm run test:integration
```

Unit tests use explicit mocks. Integration tests require the running API and real
PostgreSQL/PostGIS/Redis, create uniquely tagged fictional tenants, and retain
those fixtures with disabled users after testing. They never reset the database.
The CLI provisioning idempotency and every default role's grants are checked,
including foreign-company grants and zero-permission rejection.

Swagger UI: `http://localhost:3001/docs/`. OpenAPI JSON:
`http://localhost:3001/openapi.json`. It documents 17 implemented paths, bearer
authentication and the relative API server `/`. Future finance/delivery/offline
modules are not presented as implemented endpoints.

Dependency decisions and final executed results are recorded in
[HANDOFF.md](HANDOFF.md). The preserved historical incident and the exact
non-destructive constraint validation procedure are in [SECURITY.md](SECURITY.md).
Do not validate that constraint by deleting/reassigning data without owner
approval. No volume deletion or global Docker cleanup is needed.


## Finance workspace

`GET /api/v1/finance` and `POST /api/v1/finance/sync` require a bearer session and explicit company-scoped finance grants. The new migration creates `finance_workspaces`. Monetary amounts are integer agorot in the API; operation UUIDs provide idempotency. The workspace, audit log, customer balance, and issued invoice/offline sales order commit atomically under a tenant advisory lock. See [the finance guide](../src/features/finance/README.md) for behavior, local account setup, tests, and limits. Existing installations must explicitly reprovision one selected company to receive the new baseline grants; there is no automatic role escalation.
