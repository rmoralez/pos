import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Debugging /api/cash-registers/current issue...\n');

  // Get the Admin Demo user
  const user = await prisma.user.findFirst({
    where: {
      email: 'admin@supercommerce.com',
    },
    include: {
      tenant: true,
    },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`✓ User found: ${user.name}`);
  console.log(`  Tenant ID: ${user.tenantId}`);
  console.log(`  Location ID: ${user.locationId}`);

  // Try to find open cash register like the API does
  const where: any = {
    tenantId: user.tenantId,
    status: 'OPEN',
  };

  if (user.locationId) {
    where.locationId = user.locationId;
  }

  console.log('\nSearching for cash register with criteria:');
  console.log(JSON.stringify(where, null, 2));

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
    console.log('\n❌ No cash register found with these criteria');

    // Check if there are any open registers for this tenant
    const anyOpen = await prisma.cashRegister.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'OPEN',
      },
      include: {
        location: true,
        user: true,
      },
    });

    console.log(`\nFound ${anyOpen.length} open register(s) for this tenant:`);
    anyOpen.forEach(reg => {
      console.log(`  - ID: ${reg.id}`);
      console.log(`    Location: ${reg.location.name} (ID: ${reg.locationId})`);
      console.log(`    User: ${reg.user.name}`);
      console.log(`    User location ID: ${user.locationId}`);
      console.log(`    Match: ${reg.locationId === user.locationId ? 'YES' : 'NO'}`);
    });
  } else {
    console.log('\n✓ Cash register found!');
    console.log(`  ID: ${cashRegister.id}`);
    console.log(`  Location: ${cashRegister.location.name}`);
    console.log(`  User: ${cashRegister.user.name}`);
    console.log(`  Opened at: ${cashRegister.openedAt}`);

    // Try to get transactions with movementType
    const transactions = await prisma.cashTransaction.findMany({
      where: {
        cashRegisterId: cashRegister.id,
      },
      include: {
        movementType: true,
      },
    });

    console.log(`\n  Transactions: ${transactions.length}`);
    transactions.forEach(t => {
      console.log(`    - Amount: ${t.amount}, Type: ${t.movementType?.transactionType || 'NULL'}`);
    });
  }
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
