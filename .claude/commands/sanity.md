---
name: sanity
description: Quick sanity check - runs fast validation for small changes
---

# Quick Sanity Check

Run a fast validation check (~30 seconds) for rapid feedback during development.

## Steps to Execute

1. **TypeScript Type Check**
   - Run: `npx tsc --noEmit`
   - Check for type errors
   - Report any issues found

2. **Git Status**
   - Run: `git status --short`
   - Run: `git branch --show-current`
   - Show current branch and changes
   - Warn if on main/master branch

3. **Changed Files Tests**
   - Run: `git diff --name-only HEAD`
   - For each changed file, run related tests:
     ```bash
     npm test -- --findRelatedTests $(git diff --name-only HEAD)
     ```
   - Report pass/fail status

4. **Quick Lint** (if ESLint configured)
   - Run: `npx eslint $(git diff --name-only HEAD | grep -E '\\.(ts|tsx)$')`
   - Report lint issues

5. **Summary**
   - Show total time taken
   - List what passed/failed
   - If all passed: "✅ SANITY CHECK PASSED - Safe to commit"
   - If failed: "❌ FIX ISSUES FIRST" with details

## Output Format

```
⚡ Quick Sanity Check
====================

[1/4] TypeScript Check...
  Status: ✅ No type errors

[2/4] Git Status...
  Branch: feature/booking-fix
  Files: 2 modified

[3/4] Changed Files Tests...
  Testing: src/lib/utils.ts
  Status: ✅ 3/3 tests passed

[4/4] Quick Lint...
  Status: ✅ No issues

====================
✅ SANITY CHECK PASSED (12s)
Safe to commit
```

**Note:** This is a FAST check. For comprehensive validation before pushing, use `/pre-push`.
