# Preview Environment Setup — Manual Steps Required

## Prerequisites
- Neon API key (https://console.neon.app → Account Settings → API Keys)
- Vercel token (https://vercel.com/account/tokens)
- GitHub auth (`gh auth login`)

## Step 1: Push release branch

```bash
gh auth login
git push origin release/sell-ready-pilot
```

## Step 2: Create Neon production snapshot

```bash
# Install neonctl
npm install -g neonctl

# Authenticate
neonctl --api-key=<NEON_API_KEY> projects list

# Create restore point (snapshot)
neonctl --api-key=<NEON_API_KEY> branches create \
  --project-id <PROJECT_ID> \
  --name sell-ready-preview-20260807 \
  --parent main
```

Or via API:
```bash
curl -X POST "https://console.neon.tech/api/v2/projects/<PROJECT_ID>/branches" \
  -H "Authorization: Bearer <NEON_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"branch": {"parent_id": "<PRODUCTION_BRANCH_ID>", "name": "sell-ready-preview-20260807"}}'
```

## Step 3: Get preview database URL

```bash
neonctl --api-key=<NEON_API_KEY> connection-string \
  --project-id <PROJECT_ID> \
  --branch sell-ready-preview-20260807
```

## Step 4: Run migration against preview

```bash
DATABASE_URL="<PREVIEW_CONNECTION_STRING>" npx prisma migrate deploy
```

## Step 5: Verify schema

```bash
DATABASE_URL="<PREVIEW_CONNECTION_STRING>" npx tsx scripts/verify-schema.ts
```

## Step 6: Run PIN migration

```bash
DATABASE_URL="<PREVIEW_CONNECTION_STRING>" npx tsx scripts/migrate-pin-hashes.ts
```

## Step 7: Run runtime integration tests

```bash
DATABASE_URL="<PREVIEW_CONNECTION_STRING>" npx vitest run tests/runtime/
```

## Step 8: Configure Vercel Preview env

```bash
# Add preview DATABASE_URL to Vercel
vercel env add DATABASE_URL preview --environment preview
# Paste the preview connection string when prompted

# Also set SESSION_SECRET for preview
vercel env add SESSION_SECRET preview --environment preview
```

## Step 9: Create Vercel Preview deployment

```bash
vercel --yes --environment preview
# This creates a preview deployment, NOT production
# Returns a preview URL like https://b-attend-xxxxx.vercel.app
```

## Step 10: Browser QA Checklist

Visit the preview URL and test all 9 roles:

| # | Role | Email | Password | Expected |
|---|------|-------|----------|----------|
| 1 | SUPER_ADMIN | superadmin@b-attend.app | Super!2026#Pilot | /admin dashboard |
| 2 | SALES_ADMIN | sales@b-attend.app | Sales!2026#Pilot | /admin leads |
| 3 | COMPANY_OWNER | owner@soufraadyan.com | Owner!2026#Pilot | /dashboard full access |
| 4 | HR_ADMIN | hr@soufraadyan.com | HR!2026#Pilot | /hr full HR access |
| 5 | BRANCH_MANAGER | manager@soufraadyan.com | Manager!2026#Pilot | /dashboard limited |
| 6 | EMPLOYEE | emp1@soufraadyan.com | Emp1!2026#Pilot | /today self-service |
| 7 | BILLING_ADMIN | billing@b-attend.app | Billing!2026#Pilot | /admin billing |
| 8 | SUPPORT_AGENT | support@b-attend.app | Support!2026#Pilot | /admin support |
| 9 | PLATFORM_OWNER | platform@b-attend.app | Platform!2026#Pilot | /admin all |

For each role, verify:
- [ ] Login succeeds with correct password
- [ ] Dashboard loads without errors
- [ ] Navigation shows correct menu items
- [ ] AR/EN toggle works
- [ ] Logout works

## Step 11: Real Device Tests

### Android Chrome
1. Open Chrome on Android device
2. Navigate to preview URL + /clock
3. Test CLOCK_IN → verify punch created
4. Test CLOCK_OUT → verify punch created
5. Test geofence detection (move outside and verify)

### iPhone Safari
1. Open Safari on iPhone
2. Navigate to preview URL + /clock
3. Test CLOCK_IN → verify punch created
4. Test CLOCK_OUT → verify punch created
5. Test geofence detection
