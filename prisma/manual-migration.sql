-- Step 1: Create MovementType table
CREATE TABLE IF NOT EXISTS "MovementType" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "transactionType" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "tenantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MovementType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 2: Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "MovementType_tenantId_name_key" ON "MovementType"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "MovementType_tenantId_idx" ON "MovementType"("tenantId");
CREATE INDEX IF NOT EXISTS "MovementType_isActive_idx" ON "MovementType"("isActive");

-- Step 3: Add movementTypeId column to CashTransaction (nullable)
ALTER TABLE "CashTransaction" ADD COLUMN IF NOT EXISTS "movementTypeId" TEXT;

-- Step 4: Create index on movementTypeId
CREATE INDEX IF NOT EXISTS "CashTransaction_movementTypeId_idx" ON "CashTransaction"("movementTypeId");

-- Step 5: Create default movement types for each tenant and migrate data
DO $$
DECLARE
  tenant_record RECORD;
  income_type_id TEXT;
  expense_type_id TEXT;
BEGIN
  -- Loop through all tenants
  FOR tenant_record IN SELECT id, name FROM "Tenant" LOOP
    -- Generate IDs for movement types
    income_type_id := 'mt_income_' || tenant_record.id;
    expense_type_id := 'mt_expense_' || tenant_record.id;

    -- Create INCOME movement type
    INSERT INTO "MovementType" (id, name, description, "transactionType", "isSystem", "isActive", "tenantId", "createdAt", "updatedAt")
    VALUES (income_type_id, 'Ingreso', 'Ingreso de efectivo', 'INCOME', true, true, tenant_record.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT DO NOTHING;

    -- Create EXPENSE movement type
    INSERT INTO "MovementType" (id, name, description, "transactionType", "isSystem", "isActive", "tenantId", "createdAt", "updatedAt")
    VALUES (expense_type_id, 'Egreso', 'Egreso de efectivo', 'EXPENSE', true, true, tenant_record.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT DO NOTHING;

    -- Update existing transactions for this tenant
    UPDATE "CashTransaction" ct
    SET "movementTypeId" = CASE
      WHEN ct.type = 'INCOME' THEN income_type_id
      WHEN ct.type = 'EXPENSE' THEN expense_type_id
    END
    FROM "CashRegister" cr
    WHERE ct."cashRegisterId" = cr.id
    AND cr."tenantId" = tenant_record.id
    AND ct."movementTypeId" IS NULL;

    RAISE NOTICE 'Processed tenant: %', tenant_record.name;
  END LOOP;
END $$;

-- Step 6: Add foreign key constraint
ALTER TABLE "CashTransaction"
ADD CONSTRAINT IF NOT EXISTS "CashTransaction_movementTypeId_fkey"
FOREIGN KEY ("movementTypeId") REFERENCES "MovementType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Drop the old type column
ALTER TABLE "CashTransaction" DROP COLUMN IF EXISTS "type";
