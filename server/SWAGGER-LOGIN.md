# Fictional Swagger development login

Swagger: http://localhost:3001/docs/

- Email: `manager@darb-dev.example`
- Company slug: `darb-swagger-dev`
- Company: `DARB Fictional Swagger Development`
- Role: `manager`, with the 12 documented manager permissions in `SECURITY.md`.

From the repository root in Windows PowerShell:

```powershell
.\server\scripts\Seed-SwaggerDev.ps1
```

The command targets only Compose project `darb`. The seed requires the backend's
actual `NODE_ENV=development`, an explicit opt-in flag, and Docker's internal
`postgres:5432/darb` database. It creates only the reserved fictional company and
user, with a same-company manager role and explicit permission grants. Colliding
identities or unexpected roles/grants cause an error rather than being adopted.
No existing business records, other tenants, or historical incidents are changed.

On the first run, a random password is generated and stored as a Windows DPAPI-
protected PSCredential in `server/.env.swagger-dev.credential.xml`. This file is
Git-ignored and excluded from Docker builds by the existing `.env.*` rules. Only
the same Windows user on the same machine can normally decrypt it. Do not commit,
share, print, or upload the credential file or its decrypted password.

Repeated runs reuse that credential, retain the same company/user, and do not
rotate an already matching password. If the local credential is lost, use
`-SetPassword` to explicitly set a new password for this reserved development
account. To choose your password privately:

```powershell
.\server\scripts\Seed-SwaggerDev.ps1 -SetPassword
```

The secure prompt does not echo input. Passwords are passed to the container over
stdin, not process arguments or environment values. Neither the seed nor the
wrapper prints the password or returned JWT. Do not put password literals into
commands, scripts, `.env.example`, documentation, Git, or chat.

To copy the generated password locally without printing it or putting it in
command history:

```powershell
$credential = Import-Clixml .\server\.env.swagger-dev.credential.xml
Set-Clipboard -Value $credential.GetNetworkCredential().Password
Remove-Variable credential
```

In Swagger, expand `POST /api/v1/auth/login`, choose **Try it out**, enter the
email and companySlug above, and paste the password into its password field.
Execute: success is HTTP 200. Copy the response's `token` locally into **Authorize**
(the token value only, without adding `Bearer `), then execute
`GET /api/v1/auth/me`: success is HTTP 200 with this manager and company.
Clear the clipboard after pasting with `Set-Clipboard -Value ''`, and avoid
screenshots or sharing Swagger's password/token-bearing request/response bodies.

The wrapper also tests login, `/auth/me`, current company and product-read access
through the real host port 3001. It prints only sanitized status/identity metadata.
The Prisma script is bind-mounted already, so no backend restart or database reset
is required. This account is development-only and must not be deployed or seeded
into a production environment.

## Executed verification

Verified against the real DARB Docker PostgreSQL and host HTTP API on 2026-11-03:

- First run created one active fictional company and one active manager user.
- Second run reused both records and the password: no duplicates or rotation.
- `POST /api/v1/auth/login`: **200**, with email/password/companySlug supplied.
- `GET /api/v1/auth/me`: **200**, using the returned JWT privately in memory.
- `GET /api/v1/companies/current` and `GET /api/v1/products`: **200**.
- PostgreSQL confirmed exactly one company/user and 12 same-company manager grants.
- The seed refused both production mode and missing explicit opt-in before writes.
- TypeScript build passed. The encrypted credential file is Git-ignored and not
  eligible for Git; no passwords or JWTs were printed or documented.
