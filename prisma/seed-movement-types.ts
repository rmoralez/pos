import { PrismaClient, CashTransactionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding default movement types for all tenants...');

  // Get all tenants
  const tenants = await prisma.tenant.findMany();
  console.log(`Found ${tenants.length} tenant(s)`);

  for (const tenant of tenants) {
    console.log(`\nProcessing tenant: ${tenant.name} (${tenant.id})`);

    // Check if tenant already has movement types
    const existingTypes = await prisma.movementType.findMany({
      where: { tenantId: tenant.id },
    });

    if (existingTypes.length > 0) {
      console.log(`  Tenant already has ${existingTypes.length} movement types, skipping...`);
      continue;
    }

    // Create default INCOME movement type
    const incomeType = await prisma.movementType.create({
      data: {
        name: 'Ingreso General',
        description: 'Ingreso de efectivo',
        transactionType: CashTransactionType.INCOME,
        isSystem: true,
        isActive: true,
        tenantId: tenant.id,
      },
    });
    console.log(`  Created default INCOME type: ${incomeType.name}`);

    // Create default EXPENSE movement type
    const expenseType = await prisma.movementType.create({
      data: {
        name: 'Egreso General',
        description: 'Egreso de efectivo',
        transactionType: CashTransactionType.EXPENSE,
        isSystem: true,
        isActive: true,
        tenantId: tenant.id,
      },
    });
    console.log(`  Created default EXPENSE type: ${expenseType.name}`);

    // Create some common movement types
    await prisma.movementType.createMany({
      data: [
        {
          name: 'Pago a Proveedor',
          description: 'Pago a proveedores',
          transactionType: CashTransactionType.EXPENSE,
          isSystem: false,
          isActive: true,
          tenantId: tenant.id,
        },
        {
          name: 'Retiro para Banco',
          description: 'Retiro de efectivo para depósito bancario',
          transactionType: CashTransactionType.EXPENSE,
          isSystem: false,
          isActive: true,
          tenantId: tenant.id,
        },
        {
          name: 'Gastos Varios',
          description: 'Gastos varios del negocio',
          transactionType: CashTransactionType.EXPENSE,
          isSystem: false,
          isActive: true,
          tenantId: tenant.id,
        },
        {
          name: 'Ingreso por Ventas',
          description: 'Ingreso por ventas en efectivo',
          transactionType: CashTransactionType.INCOME,
          isSystem: false,
          isActive: true,
          tenantId: tenant.id,
        },
      ],
    });
    console.log(`  Created 4 additional common movement types`);
  }

  console.log('\n✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
