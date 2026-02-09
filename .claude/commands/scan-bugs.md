---
name: scan-bugs
description: Proactive bug detection - scans code for common bug patterns
---

# Bug Scanner

Scan code for potential bugs before they cause runtime errors.

## Scan Categories

### 1. Null Safety Issues (CRITICAL)
```bash
grep -rn "session!\\." src/
grep -rn "\\.user!" src/
```

Look for:
- Unsafe non-null assertions (`!`)
- Missing null checks
- Optional chaining not used

### 2. Promise Handling (HIGH)
```bash
grep -rn "async function" src/ | while read line; do
  # Check if function has try/catch
done
```

Look for:
- Async functions without try/catch
- Unhandled promise rejections
- Missing error handling

### 3. Database Query Safety (CRITICAL)
```bash
grep -rn "where:.*req\\." src/
grep -rn "where:.*body\\." src/
```

Look for:
- Request data used directly in queries
- Missing input validation
- No Zod schema validation

### 4. Missing Imports (HIGH)
```bash
grep -rn "crypto\\." src/ | grep -v "import.*crypto"
grep -rn "randomUUID" src/ | grep -v "import"
```

Look for:
- Node.js globals used without import
- Undefined variables

### 5. Security Issues (HIGH)
```bash
grep -rn "process\\.env\\." src/
grep -rn "API_KEY\\|SECRET\\|PASSWORD" src/
```

Look for:
- Hardcoded secrets
- Exposed API keys
- Insecure patterns

## Output Format

```
🔍 BUG SCANNER RESULTS
======================

Scan completed in 2m 14s
Files scanned: 143
Issues found: 8

CRITICAL Issues: 2
HIGH Priority: 3
MEDIUM Priority: 2
LOW Priority: 1

---

❌ CRITICAL: Null Safety Issue
File: src/app/(dashboard)/reservas/page.tsx:45
Line: const bookings = session.user.bookings;

Problem: Accessing property on potentially null object

Fix:
  if (!session?.user) {
    redirect("/login");
  }
  const bookings = session.user.bookings;

---

❌ CRITICAL: Missing Input Validation
File: src/app/api/bookings/route.ts:128
Line: const booking = await db.booking.findFirst({
        where: { id: request.body.id }
      });

Problem: Using request data directly in query

Fix:
  const { id } = bookingSchema.parse(request.body);
  const booking = await db.booking.findFirst({
    where: { id }
  });

---

⚠️  HIGH: Unhandled Promise
File: src/lib/payments.ts:67

[continues with more issues...]

---

Summary saved to: test-results/bug-scan-report.md
```

## Severity Levels

- **CRITICAL:** Will cause crashes/data corruption → Fix before push
- **HIGH:** Likely production errors → Fix before merge
- **MEDIUM:** Potential issues → Fix during refactoring
- **LOW:** Code quality → Fix when convenient

**This scanner caught the null session bug and crypto import issues!**
