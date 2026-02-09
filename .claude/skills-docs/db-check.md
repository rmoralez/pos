# Database Schema Validator

**SAFETY FIRST**: This skill validates database schema integrity and **ALWAYS asks for confirmation** before making any changes.

## Description

Comprehensive database schema validation that compares your Prisma schema against the actual database, detects mismatches, and helps you fix them safely.

## When to Use

- After modifying Prisma schema files
- Before deploying to production
- When experiencing database-related errors
- Weekly as a preventive health check
- After pulling changes that include schema updates

## What It Does

1. Compares Prisma schema with actual database
2. Detects missing columns, tables, or indexes
3. Identifies orphaned data
4. Validates foreign key constraints
5. Checks migration status
6. **Provides SQL commands for review**
7. **Asks for explicit confirmation** before any changes

---

## Validation Steps

### 1. Schema Comparison
- Pull current database schema
- Compare with `prisma/schema.prisma`
- Identify differences

### 2. Missing Columns Detection
**Example issues caught:**
- `recurrenceGroupId` column missing (the bug we just fixed!)
- New fields added to schema but not in DB
- Renamed columns

### 3. Foreign Key Validation
- Check all relationships are intact
- Verify cascade rules
- Detect broken references

### 4. Index Verification
- Ensure performance indexes exist
- Check unique constraints
- Validate composite indexes

### 5. Migration Status
- List pending migrations
- Show applied migrations
- Detect migration conflicts

### 6. Data Integrity
- Check for orphaned records
- Validate required fields
- Detect inconsistent data

---

## Safety Features

### ⚠️ CONFIRMATION REQUIRED

Before ANY schema change:

1. **Shows detailed diff** of what will change
2. **Displays SQL commands** that will be executed
3. **Asks explicit confirmation**: "Do you want to proceed?"
4. **Waits for your approval**
5. Only proceeds after you confirm

### Rollback Support

- Provides rollback SQL if changes fail
- Can revert to previous state
- Backs up schema before changes

---

## Output Format

```
🔍 Database Schema Check
========================

📊 Comparing Schema...
  Prisma Schema: prisma/schema.prisma
  Database: PostgreSQL (Supabase)

❌ SCHEMA MISMATCH DETECTED

Missing Columns:
  Table: Booking
    - recurrenceGroupId (TEXT, nullable)

  Table: User
    - lastLoginAt (TIMESTAMP, nullable)

Missing Indexes:
  Table: Booking
    - INDEX on (userId, startTime)

Migration Status:
  ✅ Applied: 12 migrations
  ⚠️  Pending: 1 migration

---

🔧 Proposed Fix:

SQL Commands to execute:
```sql
-- Add missing columns
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "recurrenceGroupId" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS "Booking_userId_startTime_idx"
  ON "Booking"("userId", "startTime");
```

---

⚠️  WARNING: These commands will modify your database schema.

Options:
  1. Review SQL carefully
  2. Test in development first
  3. Backup database before proceeding

❓ Do you want to proceed with these changes? (yes/no)
```

---

## User Actions Required

When schema mismatch is found:

**Option 1: Apply Fix**
- Review the SQL commands
- Confirm you understand the changes
- Type "yes" to proceed
- Changes are applied
- Verification runs automatically

**Option 2: Manual Fix**
- Copy the SQL commands
- Run them in your database tool
- Re-run `/db-check` to verify

**Option 3: Update Schema**
- Modify `prisma/schema.prisma` instead
- Run `npx prisma db push`
- Re-run `/db-check` to verify

---

## Common Issues Detected

### 1. Missing Column (High Priority)
```
❌ Column 'Booking.recurrenceGroupId' does not exist
   Impact: API calls will fail
   Fix: Add column to database
```

### 2. Type Mismatch (Medium Priority)
```
⚠️  Column 'User.age' type mismatch
   Schema expects: INTEGER
   Database has: VARCHAR
   Fix: Migrate data and alter column type
```

### 3. Missing Index (Low Priority)
```
ℹ️  Missing performance index
   Table: Booking
   Recommended: INDEX on (startTime, status)
   Impact: Slower queries on large datasets
```

### 4. Orphaned Data (Medium Priority)
```
⚠️  Found 5 Booking records with missing Room references
   These bookings reference deleted rooms
   Action required: Clean up or restore rooms
```

---

## Commands Run

```bash
# Pull current schema from database
npx prisma db pull --force

# Compare schemas (internal logic)
diff <(cat prisma/schema.prisma) <(generated schema)

# Check migrations
npx prisma migrate status

# Validate data integrity
psql $DATABASE_URL -c "SELECT query..."

# Apply fixes (only after confirmation)
psql $DATABASE_URL -c "SQL_COMMANDS"
```

---

## Safety Checklist

Before confirming schema changes:

- [ ] Review all SQL commands carefully
- [ ] Understand impact of each change
- [ ] Backup database (production)
- [ ] Test in development first
- [ ] Have rollback plan ready
- [ ] Verify off-peak hours (production)
- [ ] Notify team (if applicable)

---

## Advanced Options

### Dry Run Mode
Shows what would change without applying:
```
npx prisma db push --dry-run
```

### Force Sync
Resets database to match schema (DESTRUCTIVE):
```
npx prisma db push --force-reset
⚠️  WARNING: This deletes all data!
```

### Generate Migration
Creates a proper migration file:
```
npx prisma migrate dev --name add_missing_columns
```

---

## Error Prevention

This skill prevents:
- ✅ Accidental schema changes
- ✅ Production database corruption
- ✅ Data loss from missing columns
- ✅ Runtime errors from schema mismatches
- ✅ Silent failures

**Remember**: Database schema changes are critical. Always review carefully before confirming.

---

## Example Session

```
User: /db-check