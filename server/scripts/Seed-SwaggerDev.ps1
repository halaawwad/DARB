[CmdletBinding()]
param([switch]$SetPassword)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
if ($env:OS -ne 'Windows_NT') { throw 'This credential wrapper requires Windows DPAPI. No password was generated.' }

$repositoryRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$credentialPath = Join-Path $repositoryRoot 'server/.env.swagger-dev.credential.xml'
$email = 'manager@darb-dev.example'
$companySlug = 'darb-swagger-dev'
$credential = $null
$plainPassword = $null
$payload = $null
$login = $null
$loginBody = $null
$headers = $null
Push-Location $repositoryRoot
try {
    # Confirm this is ignored before writing any encrypted credential file.
    git check-ignore --quiet -- server/.env.swagger-dev.credential.xml
    if ($LASTEXITCODE -ne 0) { throw 'Credential file is not Git-ignored; refusing to proceed.' }
    if ($SetPassword) {
        $securePassword = Read-Host 'New fictional development password (16+ characters, up to 72 UTF-8 bytes)' -AsSecureString
        $credential = New-Object System.Management.Automation.PSCredential($email, $securePassword)
    } elseif (Test-Path -LiteralPath $credentialPath) {
        $credential = Import-Clixml -LiteralPath $credentialPath
        if ($credential -isnot [System.Management.Automation.PSCredential] -or $credential.UserName -ne $email) {
            throw 'Unexpected local credential file; refusing to use it.'
        }
    } else {
        $bytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $generated = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
        $securePassword = ConvertTo-SecureString -String $generated -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential($email, $securePassword)
        $generated = $null
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
    $plainPassword = $credential.GetNetworkCredential().Password
    if ($plainPassword.Length -lt 16 -or [Text.Encoding]::UTF8.GetByteCount($plainPassword) -gt 72) {
        throw 'Use a development password with at least 16 characters and at most 72 UTF-8 bytes.'
    }
    $payload = @{ password = $plainPassword; rotatePassword = [bool]$SetPassword } | ConvertTo-Json -Compress
    # Password travels only over stdin; it is never a Docker argument/environment value.
    # The seed checks the container's actual NODE_ENV rather than overriding it.
    $seedText = $payload | docker compose -p darb exec -T -e DARB_SWAGGER_SEED=1 backend node --import tsx prisma/seed-swagger-dev.ts
    if ($LASTEXITCODE -ne 0) { throw 'Development seeding failed. The seed output contains no credentials.' }
    $seed = $seedText | ConvertFrom-Json
    $credential | Export-Clixml -LiteralPath $credentialPath -Force

    # Verify the actual Windows-host URL used by Swagger; never output response bodies/JWTs.
    try {
        $body = @{ email = $email; password = $plainPassword; companySlug = $companySlug } | ConvertTo-Json -Compress
        $login = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 15
        $loginBody = $login.Content | ConvertFrom-Json
        $headers = @{ Authorization = 'Bearer ' + $loginBody.token }
        $me = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001/api/v1/auth/me' -Headers $headers -TimeoutSec 15
        $meBody = $me.Content | ConvertFrom-Json
        $company = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001/api/v1/companies/current' -Headers $headers -TimeoutSec 15
        $products = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001/api/v1/products' -Headers $headers -TimeoutSec 15
        if ($meBody.user.email -ne $email -or $meBody.user.role -ne 'manager' -or $meBody.company.slug -ne $companySlug -or $meBody.company.id -ne $seed.companyId) {
            throw 'Unexpected authenticated identity'
        }
        [PSCustomObject]@{
            Email = $email; CompanySlug = $companySlug; Role = $meBody.user.role
            LoginStatus = [int]$login.StatusCode; MeStatus = [int]$me.StatusCode
            CurrentCompanyStatus = [int]$company.StatusCode; ProductsStatus = [int]$products.StatusCode
            CreatedCompany = $seed.createdCompany; CreatedUser = $seed.createdUser
            PasswordChanged = $seed.passwordChanged; PermissionCount = $seed.permissionCount
            EncryptedCredentialFile = 'server/.env.swagger-dev.credential.xml'
        } | ConvertTo-Json -Compress
    } catch {
        $status = 'unavailable'
        if ($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response -and $_.Exception.Response.PSObject.Properties['StatusCode']) { $status = [int]$_.Exception.Response.StatusCode }
        throw "HTTP verification failed (status $status). The encrypted local credential is saved; no response or JWT was printed."
    }
} finally {
    $plainPassword = $null; $payload = $null; $body = $null
    $login = $null; $loginBody = $null; $headers = $null; $credential = $null
    Pop-Location
}
