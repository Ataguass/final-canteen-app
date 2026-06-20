const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  const passwordHash = await bcrypt.hash('123456', 10);
  
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Test Token Student',
      phone: '+910000000000',
      rollNumber: 'DEMO-91',
      email: 'test@student.com',
      passwordHash,
      role: 'STUDENT',
      isActive: true,
      isApproved: true,
    }
  });
  console.log('Created Demo Student!');
}

main()
  .catch(e => {
    if (e.code === 'P2002') console.log('Demo student already exists!');
    else console.error(e);
  })
  .finally(() => prisma.$disconnect());
