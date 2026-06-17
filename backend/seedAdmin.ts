import { prisma } from './src/config/database.js';
import bcrypt from 'bcryptjs';

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);
  
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    throw new Error("No tenant found. Cannot create user.");
  }

  let admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: 'Super Admin',
        phone: '9999999999',
        email: 'admin@ataguas.com',
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        isApproved: true,
      }
    });
    console.log('Created new SUPER_ADMIN user.');
  } else {
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash }
    });
    console.log('Found existing SUPER_ADMIN user and reset password.');
  }

  console.log('Login Details:');
  console.log('Phone:', admin.phone);
  console.log('Password: 123456');
}

main().catch(console.error).finally(() => prisma.$disconnect());
