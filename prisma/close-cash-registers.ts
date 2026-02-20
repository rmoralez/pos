import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Closing all open cash registers...');

  // Find all open cash registers
  const openRegisters = await prisma.cashRegister.findMany({
    where: {
      status: 'OPEN',
    },
    include: {
      location: true,
      user: true,
    },
  });

  console.log(`Found ${openRegisters.length} open cash register(s)`);

  // Close each one
  for (const register of openRegisters) {
    console.log(`\nClosing register for ${register.user.name} at ${register.location.name}`);
    console.log(`  ID: ${register.id}`);
    console.log(`  Opened at: ${register.openedAt}`);

    await prisma.cashRegister.update({
      where: { id: register.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingBalance: register.openingBalance, // Set closing balance same as opening
        notes: 'Closed automatically for development cleanup',
      },
    });

    console.log(`  ✓ Closed successfully`);
  }

  console.log('\n✅ All cash registers closed!');
}

main()
  .catch((e) => {
    console.error('Error closing cash registers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
