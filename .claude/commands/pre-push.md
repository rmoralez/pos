---
name: pre-push
description: Strict pre-push validation - runs ALL tests and checks before allowing push
---

# Pre-Push Validation (STRICT MODE)

**WARNING:** This is STRICT validation. All checks must pass before you can push.

## Validation Steps

Execute these checks in order. STOP and report if ANY check fails:

### 1. Git Status Check
```bash
git status --short
git branch --show-current
```
- Verify there are changes to push
- Warn if pushing to main/master

### 2. TypeScript Compilation
```bash
npx tsc --noEmit
```
- **FAIL if any type errors**
- Show error locations

### 3. Unit Tests
```bash
npm run test:ci
```
- Run all unit tests
- **FAIL if any test fails**
- Show failing test names

### 4. Build Verification
```bash
npm run build
```
- **FAIL if build fails**
- Report build errors

### 5. E2E Tests
```bash
npm run test:e2e
```
- Run all E2E tests
- **FAIL if any E2E test fails**
- Show which flows failed

### 6. Database Schema Check
```bash
npx prisma db pull --force --print
```
- Compare with prisma/schema.prisma
- **FAIL if schema mismatch detected**
- **ASK USER for confirmation if differences found**

### 7. Code Quality Scan
```bash
grep -r "console\\.log" src/ || true
grep -r "debugger" src/ || true
```
- Report console.log statements (warning only)
- Report debugger statements (warning only)

## Result Format

If ALL checks pass:
```
✅ PRE-PUSH VALIDATION PASSED

All checks completed successfully:
✅ TypeScript compilation
✅ Unit tests (48/48)
✅ Build
✅ E2E tests (33/33)
✅ Database schema
⚠️  2 console.log statements (warnings)

🚀 SAFE TO PUSH!
Time: 8m 32s
```

If ANY check fails:
```
❌ PRE-PUSH VALIDATION FAILED

Check results:
✅ TypeScript compilation
❌ Unit tests (47/48 passed)

Failed test:
  src/lib/utils.test.ts
    ✗ formatCurrency should handle negative numbers

❌ PUSH BLOCKED
Fix the failing tests before pushing.

Full report saved to: test-results/pre-push-report.md
```

## Important

- This is **STRICT MODE** - no push allowed if checks fail
- Database schema changes **require explicit confirmation**
- All tests must pass - no exceptions
- Expected runtime: 8-15 minutes
