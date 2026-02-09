# Pre-Push Validation

**STRICT MODE**: This skill performs comprehensive validation before allowing a git push. All checks must pass.

## Description

Runs complete validation to ensure code quality and prevent broken code from being pushed to the repository. This is your safety net before pushing changes.

## When to Use

- Before every `git push`
- After completing a feature
- Before creating a pull request

## What It Does

This skill runs a comprehensive suite of checks in strict mode. **If ANY check fails, the push is BLOCKED**.

---

## Validation Steps

### 1. Git Status Check
- Verify repository is clean or has staged changes
- Check current branch
- Warn if pushing to main/master

### 2. TypeScript Compilation
- Run `npx tsc --noEmit` to check for type errors
- **BLOCKS if compilation fails**

### 3. Unit Tests
- Run all unit tests with `npm run test:ci`
- Verify all 48+ tests pass
- **BLOCKS if any test fails**

### 4. E2E Tests
- Build the project first
- Run complete E2E test suite
- Test all user flows:
  - Professional booking
  - Locatario management
  - Admin operations
  - Payment flows
- **BLOCKS if any E2E test fails**

### 5. Database Schema Validation
- Compare Prisma schema vs database schema
- Check for missing columns
- Verify migrations are applied
- **BLOCKS if schema mismatch detected**
- **REQUIRES CONFIRMATION** for any schema changes

### 6. Code Quality Checks
- Scan for `console.log` statements (warn only)
- Check for `debugger` statements (warn only)
- Look for TODO/FIXME comments (report only)

### 7. Build Verification
- Run `npm run build`
- Verify build completes without errors
- Check for build warnings
- **BLOCKS if build fails**

---

## Output

The skill will provide:

1. ✅ **Success Report** if all checks pass
2. ❌ **Detailed Error Report** if any check fails
3. 📊 **Summary** of all validations

All results are saved to `test-results/pre-push-report.md`

---

## Failure Handling

**If ANY check fails:**

1. **Push is BLOCKED** - you cannot push until issues are fixed
2. Detailed error report is shown
3. Specific failing tests/checks are listed
4. File locations and error messages provided
5. Suggested fixes are shown

**To push after fixing:**
- Fix the reported issues
- Run `/pre-push` again
- Only push when all checks pass

---

## Expected Runtime

- Fast path (all cached): ~2-3 minutes
- Full validation: ~5-8 minutes
- With E2E tests: ~8-12 minutes

---

## Example Output

```
🔍 Pre-Push Validation Started
===============================

[1/7] ✅ Git Status Check
  Branch: feature/new-booking
  Status: 3 files staged

[2/7] ✅ TypeScript Compilation
  No type errors found

[3/7] ✅ Unit Tests (48 tests)
  All tests passed in 12.4s

[4/7] ✅ E2E Tests (33 scenarios)
  Professional flows: ✅ (9/9)
  Locatario flows: ✅ (12/12)
  Admin flows: ✅ (7/7)
  Payment flows: ✅ (5/5)

[5/7] ✅ Database Schema
  Schema is in sync

[6/7] ⚠️  Code Quality
  Found 2 console.log statements (warnings)

[7/7] ✅ Build
  Build completed successfully

===============================
✅ ALL CHECKS PASSED
🚀 Safe to push!
```

---

## Error Example

```
🔍 Pre-Push Validation Started
===============================

[1/7] ✅ Git Status Check
[2/7] ✅ TypeScript Compilation
[3/7] ❌ Unit Tests (48 tests)

  FAILED: src/lib/utils.test.ts
    ✗ formatCurrency should handle negative numbers
      Expected: "-$1,234.56"
      Received: "$-1,234.56"

  1 test failed out of 48

===============================
❌ PUSH BLOCKED
Fix the failing tests before pushing.

See test-results/pre-push-report.md for details.
```

---

## Commands Run

```bash
# 1. Git status
git status --short
git branch --show-current

# 2. TypeScript
npx tsc --noEmit

# 3. Unit tests
npm run test:ci

# 4. Build
npm run build

# 5. E2E tests
npm run test:e2e

# 6. Database check
npx prisma db pull --force
# (compares with schema)

# 7. Code scan
grep -r "console\\.log" src/
grep -r "debugger" src/
```

---

## Notes

- This skill is **strict** - no overrides allowed
- All checks must pass to proceed
- Database schema changes require explicit confirmation
- Code quality warnings don't block push
- Test failures always block push

**Remember**: This is your last line of defense before pushing code. If it fails, there's a real issue that needs fixing.
