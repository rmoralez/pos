# Bug Scanner

**PROACTIVE BUG DETECTION**: Scans code for common patterns that cause bugs.

## Description

Analyzes code for potential bugs, security issues, and code quality problems before they cause runtime errors.

## When to Use

- After writing new features
- Before code reviews
- Weekly as preventive maintenance
- When debugging mysterious issues

---

## What It Scans For

### 1. Null Safety Issues (CRITICAL)
Based on the dashboard bug we found:

```typescript
// ❌ BAD - Can crash if session is null
const user = session!.user;

// ✅ GOOD - Handles null safely
if (!session) {
  redirect("/login");
}
const user = session.user;
```

Detects:
- Missing null checks
- Unsafe use of `!` (non-null assertion)
- Optional chaining not used: `obj.prop` vs `obj?.prop`

### 2. Promise Handling (HIGH)

```typescript
// ❌ BAD - Unhandled rejection
async function fetchData() {
  const data = await fetch(url); // No error handling
}

// ✅ GOOD - Proper error handling
async function fetchData() {
  try {
    const data = await fetch(url);
  } catch (error) {
    console.error("Failed to fetch", error);
    throw error;
  }
}
```

Detects:
- Missing try/catch blocks
- Unhandled promise rejections
- Async functions without error handling

### 3. Database Query Safety (CRITICAL)

```typescript
// ❌ BAD - Missing validation
const booking = await db.booking.findUnique({
  where: { id: req.body.id } // Not validated!
});

// ✅ GOOD - Validated input
const validatedId = bookingIdSchema.parse(req.body.id);
const booking = await db.booking.findUnique({
  where: { id: validatedId }
});
```

Detects:
- Direct use of request data in queries
- Missing input validation with Zod
- SQL injection risks (raw queries)

### 4. Missing Imports (HIGH)
Based on the crypto import bug:

```typescript
// ❌ BAD - Using without import
const id = crypto.randomUUID(); // ReferenceError!

// ✅ GOOD - Properly imported
import { randomUUID } from "crypto";
const id = randomUUID();
```

Detects:
- Missing Node.js imports
- Undefined variables
- Missing React hooks imports

### 5. React/Next.js Patterns (MEDIUM)

```typescript
// ❌ BAD - Missing error boundary
<Component /> // Can crash entire app

// ✅ GOOD - Wrapped in error boundary
<ErrorBoundary>
  <Component />
</ErrorBoundary>
```

Detects:
- Missing error boundaries
- Improper hook usage
- Missing `"use client"` directives
- Server component async issues

### 6. Security Issues (HIGH)

Detects:
- Exposed API keys in code
- Missing CSRF protection
- Insecure password handling
- Missing rate limiting
- SQL injection risks
- XSS vulnerabilities

### 7. Performance Issues (LOW)

Detects:
- Large bundle imports
- Missing pagination
- N+1 query patterns
- Missing indexes (database)

---

## Output Format

```
🔍 Bug Scanner Results
======================

CRITICAL Issues (Must Fix): 2
HIGH Priority: 5
MEDIUM Priority: 8
LOW Priority: 12

---

❌ CRITICAL: Null Safety Issue
File: src/app/(dashboard)/reservas/page.tsx:45
Problem: Accessing property on potentially null object

Code:
  const bookings = session.user.bookings; // session could be null

Fix:
  if (!session?.user) {
    redirect("/login");
  }
  const bookings = session.user.bookings;

---

❌ CRITICAL: Missing Input Validation
File: src/app/api/bookings/route.ts:128
Problem: Using request data directly in database query

Code:
  const booking = await db.booking.findFirst({
    where: { id: request.body.id }
  });

Fix:
  const { id } = bookingSchema.parse(request.body);
  const booking = await db.booking.findFirst({
    where: { id }
  });

---

⚠️  HIGH: Unhandled Promise Rejection
File: src/lib/payments.ts:67
Problem: Async function without try/catch

Code:
  async function processPayment(amount) {
    const result = await mercadoPago.create(amount);
    return result;
  }

Fix:
  async function processPayment(amount) {
    try {
      const result = await mercadoPago.create(amount);
      return result;
    } catch (error) {
      logger.error("Payment failed", error);
      throw new PaymentError(error);
    }
  }

---

Summary Report saved to: test-results/bug-scan-report.md
```

---

## Severity Levels

**CRITICAL** - Will cause crashes or data corruption
- Must fix before pushing
- Blocks production deployment

**HIGH** - Likely to cause errors in production
- Should fix before merging
- Can cause user-facing issues

**MEDIUM** - Potential issues under certain conditions
- Fix during refactoring
- Code smell or bad practice

**LOW** - Code quality or performance concerns
- Fix when convenient
- Nice to have improvements

---

## Commands Run

```bash
# TypeScript strict checks
npx tsc --noEmit --strict

# ESLint with security rules
npx eslint src/ --ext .ts,.tsx

# Custom pattern matching
grep -r "session!\\." src/  # Unsafe non-null assertions
grep -r "await.*without.*try" src/  # Missing try/catch
grep -r "process\\.env\\." src/  # Hardcoded env vars

# Prisma query analysis
grep -r "where:.*req\\." src/  # Unsafe query params
```

---

## Configuration

Create `.claude/bug-scan-rules.json` for custom rules:

```json
{
  "rules": {
    "null-safety": "error",
    "promise-handling": "error",
    "input-validation": "error",
    "security-headers": "warn"
  },
  "ignore": [
    "src/test/**",
    "**/*.test.ts"
  ]
}
```

---

## Integration

Use in `/pre-push`:
- Scans code automatically
- Reports issues before push
- Can be configured to block on CRITICAL issues

---

## False Positives

If a warning is incorrect:

```typescript
// @bug-scan-ignore: null-safety
// Reason: session is guaranteed here by middleware
const user = session!.user;
```

Use sparingly and always provide a reason!
