# Release Process

Follow this checklist for every update. Skip nothing — the version bump is mandatory.

---

## 1. Make your changes

Write code, update docs, fix bugs, adjust config — whatever the update is.

---

## 2. Bump the version

Choose **exactly one** command depending on the nature of the change:

| Change type | Command | Example result |
|---|---|---|
| Normal update (code, UI, config, docs, bug fix) | `npm run version:patch` | `1.0.1` → `1.0.2` |
| Intentional new feature release | `npm run version:minor` | `1.0.x` → `1.1.0` |
| Breaking change or major milestone | `npm run version:major` | `1.x.x` → `2.0.0` |

**Rule:** Every shipped update gets a new patch version at minimum. Never ship two different states of the app at the same version number.

Verify the new version:
```bash
npm run version:show
```

---

## 3. Run quality checks

```bash
npm run lint
npm test
```

Both must pass before committing.

---

## 4. Commit everything together

Include the version bump, your changes, and any doc updates in a single commit so the version number always matches what is in the repo:

```bash
git add -A
git commit -m "vX.Y.Z - <short description of what changed>"
```

Examples:
```bash
git commit -m "v1.0.2 - fix Key Vault error cause propagation"
git commit -m "v1.1.0 - add subscriber CSV export feature"
git commit -m "v2.0.0 - migrate to new DPSS API v3"
```

---

## 5. Push to GitHub

```bash
git push origin main
```

---

## Quick reference

```bash
# Patch bump + lint + test + commit in one flow
npm run version:patch
npm run lint && npm test
git add -A && git commit -m "vX.Y.Z - <description>"
git push origin main
```
