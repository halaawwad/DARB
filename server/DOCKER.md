# DARB local Docker development

Run the commands below in PowerShell from the repository root. Docker Compose
uses the root `.env`; `server/.env` is not loaded into the containers. The root
`.env` is already gitignored. To set up a new checkout, copy `.env.example` to
`.env` and replace the password and JWT placeholders with random local secrets.
Use URL-safe database names/usernames and a hexadecimal password, because Compose
inserts these into a PostgreSQL URL. Do not overwrite an existing `.env`.

## Check before starting

```powershell
docker context show
docker ps --format 'table {{.Names}}\t{{.Ports}}'
$busy = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in 3001,5434,6380 })
if ($busy.Count -gt 0) {
    $busy | Format-Table LocalAddress,LocalPort,OwningProcess
    throw 'A required DARB port is occupied. Leave the owning project unchanged.'
}
docker compose -p darb config --quiet
if ($LASTEXITCODE -ne 0) { throw 'DARB Compose validation failed.' }
docker compose -p darb up -d --build --wait --wait-timeout 180
```

DARB uses host PostgreSQL port 5434 to avoid the other project's 5433 mapping.
Repeat the port check immediately before a fresh startup. For an existing DARB
stack, verify that listeners belong to DARB before recreating its backend only.

## Verify

```powershell
docker compose -p darb ps
docker compose -p darb logs --tail 100 backend
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/ready
docker compose -p darb exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose -p darb exec redis redis-cli ping
docker compose -p darb exec backend npx --no-install prisma migrate status
```

`/ready` checks both PostgreSQL and Redis. Docker's backend healthcheck uses
Node's built-in `fetch`, available in the Node 20 image, and calls `/ready`.

The backend listens on `0.0.0.0:3000` inside Docker, published as `3001:3000`
on the Windows host. For Expo Go on a phone on the same LAN, use
`http://<computer-LAN-IPv4>:3001` (try `/health` in the phone browser).
Windows Firewall must allow that connection; these changes do not modify firewall
rules or the Expo frontend. Native Expo Go requests do not require browser CORS.
For browser clients, add their actual origins to `CORS_ORIGIN` in the root `.env`.

PostgreSQL and Redis are only published to host loopback at ports 5434 and 6380.
Backend connections stay on `postgres:5432` and `redis:6379`.

## Dependencies, migrations, and isolation

- The fixed Compose project name is `darb`; its volumes are
  `darb_postgres_data` and `darb_redis_data`, and its network is `darb_default`.
  No external/shared resources or fixed container names are configured.
- The backend waits for healthy PostgreSQL and Redis. It regenerates Prisma's
  client and applies committed migrations with `prisma migrate deploy` before
  starting `tsx watch`. A failed generation/migration prevents application startup.
- `npm ci --include=dev` installs the lockfile at image build time. Source, Prisma
  files and TypeScript configuration are read-only bind mounts; dependencies stay
  inside the image. Rebuild with the startup command after package/lockfile changes.
- Create new migrations intentionally with Prisma's development workflow, review
  and retain the migration files, then let startup deploy them. Startup never runs
  `migrate dev`, `db push`, resets or seeds automatically.
- Two missing reverse relations on `Company` were added so Prisma can generate.
  They do not change database tables. The PostgreSQL migration lock is explicit.
- PostgreSQL credentials initialize a new data volume only. Changing `.env` later
  does not change the password stored in an existing database. Preserve the volume
  and update credentials deliberately rather than deleting data.

See `SECURITY.md` for the permission matrix, explicit provisioning, the historical
checkpoint ownership violation, and unit/real-service regression commands.
After changing package scripts, test files or test configs, rebuild only DARB's
backend with `docker compose -p darb up -d --build --no-deps --wait backend`.
LAN access still requires a physical-device check. Do not use volume deletion or
global Docker cleanup commands.
