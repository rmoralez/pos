import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing /api/cash-registers/current logic...\n');

  // Get the Admin Demo user (the one that should be logged in)
  const user = await prisma.user.findFirst({
    where: {
      email: 'admin@supercommerce.com',
    },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`✓ User: ${user.name}`);
  console.log(`  Tenant ID: ${user.tenantId}`);
  console.log(`  Location ID: ${user.locationId}`);

  // Simulate the API logic exactly
  const locationId = user.locationId; // No query param in this test

  const where: any = {
    tenantId: user.tenantId,
    status: 'OPEN',
  };

  if (locationId) {
    where.locationId = locationId;
  }

  console.log('\nSearching with:');
  console.log(JSON.stringify(where, null, 2));

  // Find cash register
  const cashRegister = await prisma.cashRegister.findFirst({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      location: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          sales: true,
          transactions: true,
        },
      },
    },
  });

  if (!cashRegister) {
    console.log('\n❌ No cash register found (API would return 404)');
    return;
  }

  console.log('\n✓ Cash register found!');
  console.log(`  ID: ${cashRegister.id}`);
  console.log(`  Status: ${cashRegister.status}`);
  console.log(`  Location: ${cashRegister.location.name}`);
  console.log(`  User: ${cashRegister.user.name}`);
  console.log(`  Opened at: ${cashRegister.openedAt}`);

  // Calculate balances
  const [salesTotal, transactions] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        cashRegisterId: cashRegister.id,
        status: 'COMPLETED',
      },
      _sum: {
        total: true,
      },
    }),
    prisma.cashTransaction.findMany({
      where: {
        cashRegisterId: cashRegister.id,
      },
      include: {
        movementType: true,
      },
    }),
  ]);

  const salesAmount = Number(salesTotal._sum.total || 0);
  const incomes = transactions
    .filter((t) => t.movementType?.transactionType === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = transactions
    .filter((t) => t.movementType?.transactionType === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const currentBalance =
    Number(cashRegister.openingBalance) + salesAmount + incomes - expenses;

  console.log('\n✓ Calculations successful:');
  console.log(`  Opening balance: ${cashRegister.openingBalance}`);
  console.log(`  Sales: ${salesAmount}`);
  console.log(`  Incomes: ${incomes}`);
  console.log(`  Expenses: ${expenses}`);
  console.log(`  Current balance: ${currentBalance}`);

  console.log('\n✅ API would return 200 with cash register data');
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
