# Quick Sanity Check

**FAST VALIDATION**: Quick health check for rapid feedback during development.

## Description

Lightweight validation that runs in under 1 minute. Perfect for checking small changes without running the full test suite.

## When to Use

- After small code changes
- Before creating a commit
- During active development
- When you need quick feedback

---

## What It Does

### 1. TypeScript Type Check (~10 seconds)
```bash
npx tsc --noEmit
```
- Checks for type errors
- No compilation needed
- Fast feedback

### 2. Changed Files Test (~20 seconds)
- Detects modified files with git
- Runs only tests related to changed files
- Skips unrelated tests

### 3. Git Status Check (~1 second)
- Shows current branch
- Lists staged/unstaged changes
- Warns if on main/master

### 4. Quick Lint (~5 seconds)
- Runs linter on changed files only
- Reports syntax errors
- Code style issues

### 5. Build Test (~15 seconds)
- Quick build check (no full build)
- Verifies imports resolve
- Checks for missing dependencies

---

## Output Example

```
⚡ Quick Sanity Check
====================

[1/5] ✅ TypeScript (8s)
  No type errors

[2/5] ✅ Changed Files Tests (14s)
  Modified: src/lib/utils.ts
  Tests: 3/3 passed

[3/5] ✅ Git Status
  Branch: feature/booking-fix
  Changes: 2 files modified

[4/5] ✅ Quick Lint (3s)
  No issues found

[5/5] ✅ Build Check (9s)
  All imports resolve

====================
✅ SANITY CHECK PASSED
Safe to commit (34s total)
```

---

## When It Fails

```
⚡ Quick Sanity Check
====================

[1/5] ❌ TypeScript (6s)

  Error in src/lib/utils.ts:42:
    Type 'string | undefined' is not assignable to type 'string'

[2/5] ⏭️  Skipped (previous check failed)

====================
❌ FIX TYPE ERRORS FIRST
Run /sanity again after fixing
```

---

## Commands Run

```bash
# TypeScript check
npx tsc --noEmit

# Get changed files
git diff --name-only HEAD

# Run tests for changed files
npm test -- --findRelatedTests $(git diff --name-only HEAD)

# Git status
git status --short
git branch --show-current

# Quick lint
npx eslint $(git diff --name-only HEAD | grep -E '\\.(ts|tsx)$')

# Build check
npx next build --no-lint --dry-run
```

---

## Comparison with /pre-push

| Feature | /sanity | /pre-push |
|---------|---------|-----------|
| Speed | ~30 sec | ~10 min |
| Tests | Changed files only | All tests |
| E2E | No | Yes |
| Build | Quick check | Full build |
| Coverage | No | Yes |
| Strict | No | Yes |

**Use /sanity** for: Quick iterations, small changes
**Use /pre-push** for: Before pushing, major changes

---

## Tips

- Run `/sanity` frequently during development
- Use it as a "save point" check
- Combine with watch mode for instant feedback:
  ```bash
  npm run test:watch
  ```

- If `/sanity` passes, your change is probably safe
- Still run `/pre-push` before actually pushing

---

## Integration with Development Workflow

```
Write code
  ↓
/sanity ← Quick check
  ↓
Continue if passed, fix if failed
  ↓
More changes...
  ↓
/sanity again
  ↓
Ready to commit?
  ↓
/pre-push ← Full validation
  ↓
git push
```
