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
- `npm run start:test-smtp` - start local SMTP catcher (`localhost:1025`, UI on `http://localhost:8025`)
- `npm run stop:test-smtp` - stop local SMTP catcher
- `npm run version:show` - print the current app version
- `npm run version:patch` - bump `X.Y.Z` to `X.Y.(Z+1)` for normal updates
- `npm run version:minor` - bump `X.Y.Z` to `X.(Y+1).0` for intentional feature release increments
- `npm run version:major` - bump `X.Y.Z` to `(X+1).0.0` for intentional major release increments
- `npm run lint` - run ESLint
- `npm test` - run Jest tests

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
  - `POST /api/admin/auth/bootstrap` with JSON `{ "email": "admin@company.com", "password": "strong-password" }`
