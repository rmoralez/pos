# Safe Deployment Workflow

**TWO-STAGE DEPLOYMENT**: Test locally first, then deploy to Vercel only after all checks pass.

## Description

Safe deployment process with built-in validation, testing, and rollback capabilities.

## When to Use

- Deploying to production
- Deploying to staging
- After major changes
- Regular releases

---

## Stage 1: Local Testing

### What It Does

1. **Build Project**
   ```bash
   npm run build
   ```
   - Verifies build succeeds
   - Checks for build errors/warnings
   - Validates all imports resolve

2. **Run All Tests Against Build**
   - Unit tests
   - E2E tests against built version
   - API endpoint tests
   - Performance checks

3. **Database Schema Verification**
   - Confirms schema is synchronized
   - Checks for pending migrations
   - **REQUIRES CONFIRMATION** for schema changes

4. **Environment Variables Check**
   - Verifies all required env vars are set
   - Warns about missing optional vars
   - Checks for hardcoded secrets

5. **Generate Deployment Report**
   - Test results summary
   - Build size analysis
   - Performance metrics
   - Checklist for manual verification

### Output Example

```
🏗️  Local Deployment Test
=========================

[1/5] ✅ Build
  Size: 2.4 MB (optimized)
  Warnings: 0

[2/5] ✅ Tests
  Unit: 48/48 passed
  E2E: 33/33 passed

[3/5] ✅ Database Schema
  Schema synchronized

[4/5] ✅ Environment Variables
  All required vars present

[5/5] ✅ Deployment Report
  Saved to: deployment-report.md

=========================
✅ LOCAL TESTS PASSED
Ready for production deployment
```

---

## Stage 2: Vercel Deployment

**ONLY proceeds if Stage 1 passes completely**

### What It Does

1. **Final Confirmation Prompt**
   ```
   ⚠️  About to deploy to PRODUCTION

   Target: https://consultalia.vercel.app
   Branch: main
   Commit: e83e54f "Add booking E2E test"

   Pre-deployment checklist:
   ✅ All tests passed
   ✅ Build successful
   ✅ Schema synchronized
   ✅ Environment variables ready

   ❓ Deploy to production? (yes/no)
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```
   - Deploys to production
   - Waits for deployment to complete
   - Captures deployment URL

3. **Post-Deployment Smoke Tests**
   - HTTP 200 on homepage
   - Login page accessible
   - API health check endpoint
   - Database connectivity test

4. **Deployment Success Notification**
   ```
   🚀 Deployment Successful!

   URL: https://consultalia.vercel.app
   Deployment ID: dpl_xxx
   Time: 2m 34s

   ✅ Smoke tests passed
   ```

### Rollback Plan

If deployment fails or smoke tests fail:

```
❌ Deployment Failed

Error: Smoke test failed - API not responding

Options:
  1. Rollback to previous deployment
  2. Check logs and retry
  3. Manual intervention

Rollback command:
  vercel rollback dpl_previous_id

Would you like to rollback? (yes/no)
```

---

## Safety Features

- **Two-stage validation** (local → production)
- **Explicit confirmation** required before deploying
- **Automated smoke tests** after deployment
- **Rollback capability** if issues detected
- **Deployment logs** saved for debugging

---

## Deployment Checklist

Before confirming deployment:

- [ ] All tests passed locally
- [ ] Database migrations applied
- [ ] Environment variables verified
- [ ] Team notified (if applicable)
- [ ] Deployment window (off-peak hours for production)
- [ ] Rollback plan ready
- [ ] Monitoring alerts configured

---

## Commands Used

```bash
# Stage 1: Local
npm run build
npm run test:all
npx prisma migrate status
env | grep -E "(DATABASE|NEXTAUTH|MERCADOPAGO)"

# Stage 2: Vercel
vercel --prod
curl https://consultalia.vercel.app/api/health
vercel rollback [deployment-id]  # if needed
```

---

## Example Full Session

```
User: /safe-deploy

🏗️  Stage 1: Local Testing
==========================
[Building and testing locally...]
✅ All local checks passed

🚀 Stage 2: Vercel Deployment
============================
⚠️  Deploy to PRODUCTION? (yes/no)

User: yes

[Deploying to Vercel...]
✅ Deployed: https://consultalia.vercel.app
✅ Smoke tests passed

Deployment successful!
```
