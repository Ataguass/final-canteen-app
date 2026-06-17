const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);
  await prisma.user.updateMany({
    where: {
      phone: { in: ['+919999999999', '9859842077'] }
    },
    data: {
      passwordHash
    }
  });
  console.log("Passwords reset to '123456'");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
