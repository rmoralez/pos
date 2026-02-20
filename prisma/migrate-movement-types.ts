import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: Adding configurable movement types...');

  // Get all tenants
  const tenants = await prisma.tenant.findMany();
  console.log(`Found ${tenants.length} tenant(s)`);

  for (const tenant of tenants) {
    console.log(`\nProcessing tenant: ${tenant.name} (${tenant.id})`);

    // Create default movement types for each tenant
    const incomeType = await prisma.movementType.create({
      data: {
        name: 'Ingreso',
        description: 'Ingreso de efectivo',
        transactionType: 'INCOME',
        isSystem: true,
        isActive: true,
        tenantId: tenant.id,
      },
    });
    console.log(`  Created INCOME movement type: ${incomeType.id}`);

    const expenseType = await prisma.movementType.create({
      data: {
        name: 'Egreso',
        description: 'Egreso de efectivo',
        transactionType: 'EXPENSE',
        isSystem: true,
        isActive: true,
        tenantId: tenant.id,
      },
    });
    console.log(`  Created EXPENSE movement type: ${expenseType.id}`);

    // Get existing transactions for this tenant via raw SQL
    const transactions = await prisma.$queryRaw<Array<{ id: string; type: string }>>`
      SELECT ct.id, ct.type
      FROM "CashTransaction" ct
      JOIN "CashRegister" cr ON ct."cashRegisterId" = cr.id
      WHERE cr."tenantId" = ${tenant.id}
    `;

    console.log(`  Found ${transactions.length} existing transaction(s)`);

    // Update transactions to use the new movement types
    for (const transaction of transactions) {
      const movementTypeId =
        transaction.type === 'INCOME' ? incomeType.id : expenseType.id;

      await prisma.$executeRaw`
        UPDATE "CashTransaction"
        SET "movementTypeId" = ${movementTypeId}
        WHERE id = ${transaction.id}
      `;
    }

    console.log(`  Updated ${transactions.length} transaction(s) with movement types`);
  }

  console.log('\n✅ Migration completed successfully!');
  console.log('\nYou can now run: npx prisma db push --accept-data-loss');
  console.log('This will remove the old "type" column from CashTransaction table.');
}

main()
  .catch((e) => {
    console.error('Error during migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
