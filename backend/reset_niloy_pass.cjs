const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Niloy@123', 10);
  await prisma.user.updateMany({
    where: {
      phone: '9678039381'
    },
    data: {
      passwordHash
    }
  });
  console.log("Password for Niloy (9678039381) reset to 'Niloy@123'");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
