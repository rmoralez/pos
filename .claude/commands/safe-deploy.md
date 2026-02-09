---
name: safe-deploy
description: Safe deployment workflow - tests locally then deploys to Vercel
---

# Safe Deployment Workflow

Two-stage deployment: Local validation → Vercel deployment

## Stage 1: Local Testing

### 1. Build Project
```bash
npm run build
```
- Verify build succeeds
- Check for warnings
- Report build size

### 2. Run All Tests Against Build
```bash
npm run test:ci
npm run test:e2e
```
- Unit tests
- E2E tests against built version
- **STOP if any test fails**

### 3. Database Schema Verification
```bash
npx prisma migrate status
```
- Check for pending migrations
- Verify schema is synced
- **ASK for confirmation if schema changes needed**

### 4. Environment Variables Check
```bash
env | grep -E "(DATABASE|NEXTAUTH|MERCADOPAGO)"
```
- Verify all required vars set
- Warn about missing optional vars

### 5. Generate Deployment Report

Create checklist:
```
✅ Build successful
✅ All tests passed
✅ Schema synchronized
✅ Env vars present
```

Save to: `test-results/deployment-report.md`

## Stage 2: Vercel Deployment

**ONLY proceed if Stage 1 passed completely**

### 1. Final Confirmation

```
⚠️  ABOUT TO DEPLOY TO PRODUCTION

Target: https://consultalia.vercel.app
Branch: main
Commit: [commit-hash] "[commit-message]"

Pre-deployment checklist:
✅ All tests passed
✅ Build successful
✅ Schema synchronized
✅ Environment variables ready

❓ Deploy to production? (yes/no)
```

**Wait for explicit confirmation**

### 2. Deploy
```bash
vercel --prod
```
- Deploy to production
- Wait for completion
- Capture deployment URL

### 3. Post-Deployment Smoke Tests
```bash
curl https://consultalia.vercel.app/
curl https://consultalia.vercel.app/api/health
```
- Verify homepage loads
- Check API responds
- Test database connectivity

### 4. Result

If successful:
```
🚀 DEPLOYMENT SUCCESSFUL!

URL: https://consultalia.vercel.app
Deployment ID: dpl_xxx
Time: 2m 34s

✅ Smoke tests passed
✅ Application responding

Deployment complete!
```

If failed:
```
❌ DEPLOYMENT FAILED

Error: [error details]

Options:
  1. Rollback to previous deployment
  2. Check logs and retry
  3. Manual intervention

Rollback command:
  vercel rollback [previous-deployment-id]

❓ Rollback? (yes/no)
```

## Safety Features

- Two-stage validation
- Explicit confirmation required
- Smoke tests after deployment
- Automatic rollback on failure
- Deployment logs saved
