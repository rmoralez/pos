# Consultalia Quality Assurance Skills

Comprehensive quality assurance workflows to ensure code quality before production.

## 📋 Available Skills

### 1. `/sanity` - Quick Sanity Check ⚡
**Runtime:** ~30 seconds
**Use:** During active development

Quick validation for small changes:
- TypeScript type checking
- Tests for changed files only
- Git status check
- Quick lint

**When to use:**
- After small code changes
- Before creating commits
- During active development
- Need quick feedback

---

### 2. `/pre-push` - Strict Pre-Push Validation 🛡️
**Runtime:** ~10-15 minutes
**Use:** Before EVERY git push

Comprehensive strict validation:
- ✅ TypeScript compilation
- ✅ All 48+ unit tests
- ✅ All E2E tests (33+ scenarios)
- ✅ Database schema validation
- ✅ Full build verification
- ✅ Code quality checks

**BLOCKS push if ANY check fails**

**When to use:**
- Before every `git push` (mandatory)
- Before creating pull requests
- After completing features

---

### 3. `/test-all` - Complete Test Coverage 📊
**Runtime:** ~10-15 minutes
**Use:** For comprehensive testing

Runs full test suite with coverage:
- Unit & integration tests
- E2E tests for all user roles:
  - Professional user flows
  - Locatario management
  - Admin operations
  - Payment & billing
- Generates HTML coverage reports

**When to use:**
- Before merging PRs
- After major changes
- Weekly regression testing
- Before releases

---

### 4. `/db-check` - Database Schema Validator 🗄️
**Runtime:** ~1-2 minutes
**Use:** Database schema verification

Validates database integrity:
- Compares Prisma schema vs actual DB
- Detects missing columns/tables
- Validates foreign keys
- Checks migration status
- **ALWAYS asks for confirmation** before changes

**When to use:**
- After modifying Prisma schema
- Before production deployment
- Weekly health checks
- When experiencing DB errors

---

### 5. `/safe-deploy` - Safe Deployment Workflow 🚀
**Runtime:** ~15-20 minutes (2 stages)
**Use:** Production deployments

Two-stage deployment:

**Stage 1: Local Testing**
- Build project
- Run all tests against build
- Verify database schema
- Check environment variables

**Stage 2: Vercel Deployment** (only if Stage 1 passes)
- Deploy to production
- Run smoke tests
- Rollback capability

**When to use:**
- Deploying to production
- Deploying to staging
- After major changes

---

### 6. `/scan-bugs` - Proactive Bug Detection 🔍
**Runtime:** ~2-3 minutes
**Use:** Bug prevention

Scans for common issues:
- Null safety problems
- Missing error handling
- Database query safety
- Security vulnerabilities
- Performance issues
- React/Next.js antipatterns

Reports with severity: CRITICAL, HIGH, MEDIUM, LOW

**When to use:**
- After writing new features
- Before code reviews
- Weekly maintenance
- Debugging mysterious issues

---

## 🎯 Recommended Workflow

### Daily Development
```bash
# Quick iteration
1. Write code
2. /sanity          # Quick check (~30s)
3. Continue if passed

# Ready to commit
4. /sanity          # Final quick check
5. git add .
6. git commit
```

### Before Pushing
```bash
# Mandatory before push
/pre-push           # Strict validation (~10min)

# Only push if ALL checks pass
git push
```

### Weekly/Periodic
```bash
/scan-bugs          # Proactive bug hunting
/db-check           # Database health check
/test-all           # Full regression testing
```

### Deployment
```bash
# For production
/safe-deploy        # Two-stage deployment

# For testing production schema
/db-check           # Verify production DB
```

---

## 🔒 Safety Guarantees

All skills guarantee:

1. **No surprises** - Shows what will happen before doing it
2. **Explicit confirmation** - Asks before destructive operations
3. **Clear output** - Detailed reports with file locations
4. **Rollback support** - Can undo changes if needed
5. **Report generation** - Saves results to `test-results/`

---

## ⚙️ Configuration

### Environment Variables Required

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="..."

# Mercado Pago (for payment tests)
MERCADOPAGO_ACCESS_TOKEN="..."
MERCADOPAGO_PUBLIC_KEY="..."
```

### Test Users

The following test users are created by `npm run db:seed`:

**E2E Tests:**
- Professional: `test-profesional@e2e.com` / `Test123!@#`
- Locatario: `test-locatario@e2e.com` / `Test123!@#`
- Admin: `test-admin@e2e.com` / `Test123!@#`

**Demo Users:**
- Professional: `profesional@demo.com` / `demo123`
- Locatario: `locatario@demo.com` / `demo123`

---

## 📊 Test Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Unit Tests | 80% | ~84% |
| E2E Tests | All flows | 33 scenarios |
| API Routes | 100% | ~78% |

---

## 🐛 Common Issues

### `/pre-push` fails with schema errors
**Solution:**
```bash
/db-check           # Fix schema first
/pre-push           # Try again
```

### E2E tests timeout
**Solution:**
- Check if dev server is running
- Verify database is seeded
- Increase timeout in playwright.config.ts

### Database schema mismatch
**Solution:**
```bash
/db-check           # Get diff
# Review SQL commands
# Confirm changes
```

---

## 📝 Reports Generated

Skills save reports to `test-results/`:

- `pre-push-report.md` - Pre-push validation results
- `full-coverage-report.html` - Test coverage HTML
- `bug-scan-report.md` - Bug scanner findings
- `deployment-report.md` - Deployment checklist

---

## 🔄 Integration with Git Hooks

Optional: Add to `.git/hooks/pre-push`:

```bash
#!/bin/bash
echo "Running pre-push validation..."
/pre-push || exit 1
```

This automatically runs `/pre-push` before every push.

---

## 📚 Learn More

- TypeScript: https://www.typescriptlang.org/
- Playwright: https://playwright.dev/
- Prisma: https://www.prisma.io/
- Next.js Testing: https://nextjs.org/docs/testing

---

## ✅ Success Checklist

Before considering a feature "done":

- [ ] `/sanity` passes
- [ ] `/test-all` shows good coverage
- [ ] `/scan-bugs` has no CRITICAL issues
- [ ] `/db-check` confirms schema is synced
- [ ] `/pre-push` passes completely
- [ ] Code reviewed
- [ ] `/safe-deploy` completes successfully

---

## 🆘 Getting Help

If a skill fails and you're unsure how to fix:

1. Read the error message carefully
2. Check the generated report in `test-results/`
3. Review the specific file and line number
4. Run `/scan-bugs` for additional insights
5. Ask for help with the specific error

---

**Last Updated:** 2026-02-08
**Created by:** Claude Code
**Project:** Consultalia - Sistema de Gestión de Consultorios
