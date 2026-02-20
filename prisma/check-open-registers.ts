import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for open cash registers...');

  const openRegisters = await prisma.cashRegister.findMany({
    where: {
      status: 'OPEN',
    },
    include: {
      location: true,
      user: true,
    },
    orderBy: {
      openedAt: 'desc',
    },
    take: 10,
  });

  console.log(`\nFound ${openRegisters.length} open cash register(s):\n`);

  for (const register of openRegisters) {
    console.log(`ID: ${register.id}`);
    console.log(`User: ${register.user.name} (${register.user.email})`);
    console.log(`Location: ${register.location.name}`);
    console.log(`Opened at: ${register.openedAt}`);
    console.log(`Opening balance: ${register.openingBalance}`);
    console.log('---');
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
