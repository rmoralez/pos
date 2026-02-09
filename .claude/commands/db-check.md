---
name: db-check
description: Database schema validator - compares Prisma schema with actual database
---

# Database Schema Validator

**SAFETY FIRST:** This command will ALWAYS ask for confirmation before making any schema changes.

## Steps to Execute

### 1. Pull Current Database Schema
```bash
npx prisma db pull --force
```
- Generates schema from current database
- Compare with existing prisma/schema.prisma

### 2. Analyze Differences

Check for:
- Missing columns
- Missing tables
- Type mismatches
- Missing indexes
- Foreign key issues

### 3. Generate Fix SQL

If differences found, generate SQL commands to fix:
```sql
-- Example
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "recurrenceGroupId" TEXT;
```

### 4. Ask for Confirmation

**CRITICAL:** Before applying ANY changes:

```
⚠️  DATABASE SCHEMA MISMATCH DETECTED

Missing Columns:
  Table: Booking
    - recurrenceGroupId (TEXT, nullable)

Proposed Fix:
---
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "recurrenceGroupId" TEXT;
---

⚠️  This will modify your database schema.

Review the SQL carefully.

❓ Do you want to proceed with these changes? (yes/no)
```

**Wait for explicit "yes" before proceeding.**

### 5. Apply Fix (if confirmed)

```bash
psql $DATABASE_URL -c "SQL_COMMANDS_HERE"
```

### 6. Verify Fix

```bash
npx prisma db pull --force
```
- Verify schema now matches
- Confirm no more differences

## Output Format

If schema is synchronized:
```
✅ DATABASE SCHEMA CHECK PASSED

Schema Status: Synchronized
Tables: All present
Columns: All present
Indexes: All present

No action needed.
```

If schema mismatch found:
```
❌ SCHEMA MISMATCH DETECTED

Issues found: 1

Missing Columns:
  - Booking.recurrenceGroupId (TEXT)

[Show SQL commands]
[Ask for confirmation]
[Apply if confirmed]
[Verify result]
```

## Safety Guarantees

- **NEVER applies changes without confirmation**
- Shows exact SQL before execution
- Provides rollback SQL if possible
- Saves backup of current schema
- Verifies changes after application

**This prevents bugs like the recurrenceGroupId issue we fixed!**
