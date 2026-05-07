# Development Workflow Guide

This document outlines practices for ongoing development and change tracking on the DPSS Subscriber Request app.

## Branch Strategy

- **main**: Production-ready code. All changes must be tested and reviewed before merging.
- **feature/***:  Individual feature development (e.g., `feature/add-export-functionality`, `feature/improve-validation`)
- **fix/***:  Bug fixes and hotfixes (e.g., `fix/email-delivery-delay`, `fix/validation-error`)
- **docs/***:  Documentation updates (e.g., `docs/api-reference`)

### Creating a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

## Commit Message Conventions

Use clear, descriptive commit messages following this format:

```
<type>: <subject>

<optional body explaining the change>
```

### Type Categories
- **feat**: New feature (e.g., `feat: add export to CSV functionality`)
- **fix**: Bug fix (e.g., `fix: correct email delivery for existing subscribers`)
- **refactor**: Code restructuring without feature changes (e.g., `refactor: simplify credential resolution`)
- **test**: Test additions or fixes (e.g., `test: add integration test for payment flow`)
- **docs**: Documentation updates (e.g., `docs: update deployment instructions`)
- **chore**: Dependency updates, config changes (e.g., `chore: upgrade @azure/identity to 4.0.0`)

### Examples
```
feat: implement two-step subscriber form with auto-fill validation

- Add existing subscriber validation via DPSS API
- Implement product selector with select-all/clear-all controls
- Add tenant tokenized input with chip rendering

fix: send requester email for existing subscriber requests

fix-issue-42: resolve Key Vault credential timeout on startup
```

## Testing Requirements

### Before Committing
All tests must pass locally:
```bash
npm test
```

This runs:
- API route tests (`tests/api.test.js`) — endpoint validation, request flow, email integration
- Health check tests (`tests/health.test.js`) — dependency availability (DB, Key Vault, CAPTCHA)
- Frontend flow tests (`tests/frontend-flow.test.js`) — two-step form behavior, payload structure

### Running Individual Test Suites
```bash
npm test -- tests/api.test.js
npm test -- tests/frontend-flow.test.js
npm test -- tests/health.test.js
```

### Before Pushing
1. Ensure all tests pass: `npm test`
2. Verify no lint errors: `npm run lint`
3. Test manually against a local SMTP catcher (see below)

## Local Development Setup

### Start Dev Server
```bash
npm run dev
```
Runs on http://localhost:3012 with auto-restart on file changes.

### Test SMTP Integration
Start a local SMTP catcher in a separate terminal:
```bash
npm run start-test-smtp
```
This starts:
- SMTP receiver on `localhost:1025` (configured in app via `SMTP_MODE=local`)
- Web UI on `http://localhost:8025` for email inspection

Stop with:
```bash
npm run stop-test-smtp
```

### Database Management
Connect to PostgreSQL (running in WSL2 Docker):
```bash
psql postgresql://postgres:postgres@172.24.216.232:5432/dpss_subscriber_requests
```

Run migrations (done at startup automatically):
```bash
npm run migrate
```

View current migration status:
```bash
\d subscription_requests
```

## Pull Request Workflow

1. **Create feature branch** from main
2. **Commit frequently** with clear messages
3. **Push to origin**: `git push -u origin feature/your-name`
4. **Create Pull Request** on GitHub with:
   - Clear description of changes
   - Link to any related issues
   - Testing steps for reviewers
5. **Address review feedback** and push updates
6. **Merge to main** once approved
7. **Delete feature branch**: `git push origin --delete feature/your-name`

## Code Standards

### Linting
All code must pass ESLint:
```bash
npm run lint
```

Fix auto-fixable issues:
```bash
npm run lint -- --fix
```

### Key Conventions
- Use async/await for async operations
- Validate all user inputs with Zod schemas
- Log errors with context (not just error message)
- Use transaction blocks for multi-step DB operations (`pool.connect()` → `client.query()` → `client.release()`)
- Include error hints in Key Vault fallback failures
- Return structured JSON responses {status, message, data}

## Deployment

### Development Environment
Deployed from `main` branch via GitHub Actions (CI workflow).

### Production Deployment
Manual promotion after GitHub Actions CI passes:
1. Verify test results in GitHub Actions
2. Docker image built and available
3. Manual deployment to prod environment (via Azure Container Instances or similar)

For release notes: See [RELEASE.md](RELEASE.md)

## Troubleshooting

### Tests Failing Locally
**Database connection error:**
```bash
# Verify PostgreSQL container is running
docker ps | grep postgres

# If not, start it
docker compose up -d postgres
```

**Key Vault auth failures:**
```bash
# Ensure Azure CLI authenticated
az account show

# Or set fallback
export KEY_VAULT_ALLOW_ENV_FALLBACK=true
```

**SMTP test mode not working:**
```bash
# Stop existing process
npm run stop-test-smtp

# Start fresh
npm run start-test-smtp
```

### Committing Line Ending Issues
Git will warn about CRLF/LF differences on Windows. This is normal:
```
warning: in the working copy of 'package.json', LF will be replaced by CRLF
```

Configure Git to handle this automatically:
```bash
git config --global core.autocrlf true
```

## Performance Considerations

### Email Delivery
- Internal alert and requester emails are sent independently with per-channel status tracking
- If one fails, the other may still succeed
- Check `/api/admin/requests/{id}` status for delivery confirmation

### Database Transactions
- Always use connection transaction blocks for multi-step operations
- Rollback on any error to maintain consistency
- Use connection timeout for long operations

### Key Vault Caching
- Secrets are cached in-memory after first resolution
- Restart app to clear cache if secret rotated
- Logs indicate cache hits/misses on startup checks

## Questions or Issues?

Refer to:
- [README.md](README.md) — Project overview and setup
- [USER_GUIDE.md](USER_GUIDE.md) — End-user instructions
- [RELEASE.md](RELEASE.md) — Version history and breaking changes
- Source code comments — Inline documentation for complex logic
