# Data Hub Subscription Request Management

Public web app for subscription intake, admin triage, and request lifecycle management using DPSS APIs.

## Stack
- Node.js + Express
- PostgreSQL
- SMTP (Nodemailer)
- Google reCAPTCHA v3

## Features
- Anonymous public intake with CAPTCHA requirement
- Existing-subscriber validation flow
- New-subscriber registration flow
- Data product retrieval with admin-managed hidden exclusions
- Product-specific tenant mappings and one global region
- Admin queue with statuses: New, In Review, Complete, Rejected
- Internal + submitter email notifications

## Documentation

**For end users:** See [USER_GUIDE.md](USER_GUIDE.md) for complete instructions on:
- Submitting subscription requests (public)
- Reviewing and managing requests (admin)
- Troubleshooting common issues
- Contact information and support

## Local setup
1. Copy `.env.example` to `.env` and configure values.
2. Start PostgreSQL (local or Docker).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run migrations:
   ```bash
   npm run db:migrate
   ```
5. Start app:
   ```bash
   npm run dev
   ```

App URLs:
- Public UI: `http://localhost:3012`
- Admin UI: `http://localhost:3012/admin`

## Scripts
- `npm run dev` - start with nodemon
- `npm run start` - start server
- `npm run db:migrate` - apply SQL migrations
- `npm run db:backup` - create PostgreSQL backup (`pg_dump` custom format)
- `npm run db:restore -- <path-to-backup>` - restore a PostgreSQL backup (`pg_restore`)
- `npm run db:backup:verify -- <path-to-backup>` - verify backup integrity (`pg_restore --list`)
- `npm run start:test-smtp` - start local SMTP catcher (`localhost:1025`, UI on `http://localhost:8025`)
- `npm run stop:test-smtp` - stop local SMTP catcher
- `npm run version:show` - print the current app version
- `npm run version:patch` - bump `X.Y.Z` to `X.Y.(Z+1)` for normal updates
- `npm run version:minor` - bump `X.Y.Z` to `X.(Y+1).0` for intentional feature release increments
- `npm run version:major` - bump `X.Y.Z` to `(X+1).0.0` for intentional major release increments
- `npm run lint` - run ESLint
- `npm test` - run Jest tests
- `npm run security:audit` - dependency vulnerability scan (fails on moderate+)
- `npm run security:test` - security regression tests

## Runtime endpoints
- `GET /health` - liveness probe
- `GET /ready` - readiness probe (includes database reachability)
- `GET /metrics` - Prometheus-style metrics for request counts/statuses and uptime

## Versioning process
Run a version bump for every shipped update so each change has a unique release number.

Recommended workflow:
1. For normal code, UI, config, or documentation changes, run `npm run version:patch`.
2. Only use `npm run version:minor` when you intentionally want to promote `X.1.X` to `X.2.0`.
3. Only use `npm run version:major` when you intentionally want to promote `1.X.X` to `2.0.0`.
4. After bumping, run `npm run lint` and `npm test`.
5. Commit the versioned files together with the rest of the change.

This keeps every update on a new version number while reserving minor and major increments for deliberate release steps.

## Notes
- `RECAPTCHA_SECRET` is required for submission endpoint.
- DPSS secrets can be sourced from Azure Key Vault by setting one or more of:
   - `DPSS_SERVICE_CLIENT_ID_KEY_VAULT_URI`
   - `DPSS_SERVICE_CLIENT_SECRET_KEY_VAULT_URI`
   - `DPSS_US_DATA_PRODUCTS_CLIENT_ID_KEY_VAULT_URI`
   - `DPSS_US_DATA_PRODUCTS_CLIENT_SECRET_KEY_VAULT_URI`
- Example secret URI:
   - `https://kv-usw-dpss1-prod.vault.azure.net/secrets/DPSSInternalClientSecret`
- Key Vault authentication uses Azure `DefaultAzureCredential`.
   - Local dev: sign in with `az login` or set `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET`
   - Azure-hosted runtime: prefer Managed Identity
- On startup, the app performs non-blocking Key Vault resolution checks and logs warnings if any configured secret URI cannot be resolved.
- Optional local fallback: set `KEY_VAULT_ALLOW_ENV_FALLBACK=true` (default in development) to allow fallback to non-empty plaintext `DPSS_*` values when Key Vault lookup fails.
- Production recommendation: keep `KEY_VAULT_ALLOW_ENV_FALLBACK=false` and use only Key Vault-backed secrets.
- SMTP modes:
   - `SMTP_MODE=real` uses `SMTP_HOST/SMTP_PORT/SMTP_SECURE/SMTP_USER/SMTP_PASS`
   - `SMTP_MODE=local` uses `LOCAL_SMTP_HOST/LOCAL_SMTP_PORT` and ignores SMTP auth/TLS settings
- Bootstrap first admin user:
   - Bootstrap is disabled by default and should remain disabled in production.
   - One-time bootstrap process:
      1. Set `ADMIN_BOOTSTRAP_ENABLED=true`
      2. Set strong `ADMIN_BOOTSTRAP_TOKEN`
      3. Call `POST /api/admin/auth/bootstrap` with header `x-bootstrap-token: <token>` and JSON payload `{ "email": "admin@company.com", "password": "strong-password" }`
      4. Immediately set `ADMIN_BOOTSTRAP_ENABLED=false` and rotate `ADMIN_BOOTSTRAP_TOKEN`

## Production hardening policy
- `JWT_SECRET` must be non-empty, or the app refuses to start.
- `ALLOWED_ORIGINS` must be explicitly configured in production.
- `KEY_VAULT_ALLOW_ENV_FALLBACK` must be `false` in production.
- `ADMIN_BOOTSTRAP_ENABLED` must be `false` in production.
- `SMTP_MODE=local` is blocked in production.
- `SMTP_SECURE=true` is required in production when `SMTP_MODE=real`.

## CI security checks
On every push/PR, GitHub Actions now runs:
- Lint + full test suite
- Dependency vulnerability scan (`npm audit`)
- Security regression tests (`tests/security.test.js`)
- Dependency review on pull requests
- Secret scanning (gitleaks)
- CodeQL static analysis
- SBOM generation (CycloneDX artifact)

## Backup and restore guidance
Recommended cadence:
- Daily automated backups
- Keep at least 14 daily copies + 8 weekly copies
- Run backup verification immediately after each backup

Example commands:
```bash
# Create backup
npm run db:backup

# Verify backup (replace path)
npm run db:backup:verify -- .runtime/backups/dpss-backup-YYYY-MM-DD.dump

# Restore backup (replace path)
npm run db:restore -- .runtime/backups/dpss-backup-YYYY-MM-DD.dump
```

Migration safety checklist:
1. Take and verify backup before running migrations.
2. Run migrations in staging first.
3. Validate `/ready` after deploy.
4. If rollback is required, redeploy last known-good build and restore verified backup.
