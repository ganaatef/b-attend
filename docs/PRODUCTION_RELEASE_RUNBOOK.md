# B-Attend Production Release & Rollback Runbook

**Status:** Required release procedure  
**Applies to:** production releases from the hardened integration/release candidate  
**Rule:** production deploy, production DB migration and merge to `main` require explicit go-live approval.

## 1. Release invariants

1. Git is the source of truth; never patch production files manually.
2. The application and database schema are one release unit, but schema migration is executed once by the designated release owner — never concurrently by arbitrary web build workers.
3. CI is fail-closed. Do not bypass TypeScript, tests, dependency audit, runtime-security or build failures.
4. Database migrations are forward-safe and additive wherever possible. Destructive schema changes require a separate expand/migrate/contract release sequence.
5. Never roll back a database by deleting data or manually editing `_prisma_migrations`.
6. A deployment is not ready until both `/api/health` and `/api/ready` return HTTP 200.
7. Secrets are configured in the deployment platform; they are never committed to Git or printed into CI logs.

## 2. Roles for one release

Assign these roles before go-live, even if one person owns more than one role:

- **Release owner:** controls the production deploy and release decision.
- **DB migration owner:** runs `prisma migrate deploy` exactly once and records the result.
- **Verifier:** runs post-deploy smoke tests and confirms business-critical flows.
- **Rollback owner:** has authority to revert application traffic immediately if a release degrades production.

## 3. Pre-release gate

The exact commit intended for production must have a green CI run covering:

- `npm ci`
- `prisma validate`
- `prisma generate`
- TypeScript check
- lint
- Arabic/English i18n parity
- unit/behavioral tests
- production dependency audit (`high` / `critical` gate)
- production build
- migrations applied to ephemeral PostgreSQL
- database-backed authorization and tenant-isolation tests

Do not accept a green run from an older SHA.

Run the production configuration preflight against the real production environment:

```bash
npm run preflight:production
```

A warning must be reviewed and explicitly accepted. A failure blocks release.

### Mandatory configuration classes

- PostgreSQL `DATABASE_URL` and `DIRECT_URL`
- `SESSION_SECRET` (strong production-only value)
- production `APP_URL` using HTTPS
- Upstash Redis REST credentials for distributed rate limiting
- production email provider + verified sender
- explicit billing mode
- if self-service billing is enabled: a real payment provider and signed webhook secret
- DB connection/pool limits appropriate to the provider
- demo seed/demo mode disabled

## 4. Database migration gate

Before changing production traffic:

1. Take/verify the provider backup or point-in-time recovery capability.
2. Record the current application SHA and current healthy deployment URL/id.
3. From a controlled release environment using production `DIRECT_URL`, run:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
```

4. Migration must exit successfully with no unresolved/failed migration.
5. Never run `prisma migrate dev`, `db push`, or schema reset against production.
6. Never edit `_prisma_migrations` manually to make a failed release appear healthy.

If a migration fails, stop. Do not deploy the new application build until the migration failure has been understood and safely resolved.

## 5. Application deploy

After the migration gate passes:

1. Deploy the exact CI-green SHA through the configured production deployment pipeline.
2. Do not change environment variables during the deployment unless that change is part of the reviewed release plan.
3. Wait for platform deployment health to stabilize.
4. Verify:

```text
GET /api/health  -> 200 {"status":"ok"}
GET /api/ready   -> 200 {"status":"ready"}
```

`/api/health` proves process + DB reachability. `/api/ready` also proves that the application-required migration is complete and there is no unresolved Prisma migration. Both responses intentionally hide DB/schema details.

## 6. Post-deploy smoke tests

Use a controlled test tenant and non-production-personal test accounts. Verify at minimum:

1. Tenant owner login.
2. Employee login/mobile bearer login.
3. Active subscription can access operational pages.
4. Suspended user loses access immediately.
5. Scoped manager cannot see another branch/department.
6. Mobile clock-in inside geofence succeeds.
7. A suspicious/outside-geofence attendance event creates a review item and resolves correctly on approve/reject.
8. Kiosk device credentials work only for the registered branch/device.
9. Invitation acceptance works and no plaintext temporary password is exposed.
10. Billing/support recovery path works for an inactive subscription without bypassing a suspended user identity.
11. Owner-only access control operations remain owner-only.
12. Audit records exist for privileged/security-sensitive changes.

## 7. Observation window

Immediately after release, monitor:

- HTTP 5xx/error rate
- `/api/health` and `/api/ready`
- DB connection saturation/timeouts
- login/auth failures
- attendance submission success/failure rate
- mobile API latency
- approval processing errors
- unusual rate-limit spikes
- payment webhook failures if self-service billing is enabled

Do not call a release stable solely because the deployment platform says “Ready”.

## 8. Rollback decision

Rollback application traffic immediately when any of these occurs and cannot be corrected safely in minutes:

- elevated 5xx/error rate
- login outage
- attendance writes are duplicated/lost/corrupted
- cross-tenant or cross-scope data exposure
- billing state corruption
- readiness returns 503 because code requires schema not present
- security regression or privilege escalation

A suspected tenant-isolation or privilege-escalation incident is a security event; stop rollout and preserve logs/audit evidence.

## 9. Application rollback

Preferred rollback:

1. Route production back to the last known-good deployment/SHA through the deployment platform.
2. Do **not** automatically reverse the database migration.
3. Re-run `/api/health` and `/api/ready` for the rollback build. Note that an older app must tolerate additive schema from the newer release.
4. Run the critical smoke tests again.
5. Document the failed SHA, impact, detection time and rollback result.

This is why destructive migrations are prohibited in a normal single release.

## 10. Database recovery

If the application rollback is insufficient because data was incorrectly mutated:

1. Stop the damaging write path/traffic first.
2. Preserve audit/event evidence.
3. Determine affected tenants/records before any recovery operation.
4. Prefer compensating forward fixes over database-wide restoration.
5. Use provider point-in-time recovery only under an explicit incident plan; a full restore can discard valid writes made after the restore point.
6. Never improvise SQL deletion in production during an incident.

## 11. Release record

For every production release record:

- release SHA
- CI run URL/id
- release owner
- migration owner
- migration result/time
- previous known-good SHA/deployment
- `/api/health` result
- `/api/ready` result
- smoke-test result
- start/end of observation window
- any accepted warnings
- rollback outcome if used

## 12. Current release constraint

Until explicit go-live approval is given, work remains on the integration/release-candidate path. Do not merge to `main`, migrate the production database or deploy production merely because CI is green.
