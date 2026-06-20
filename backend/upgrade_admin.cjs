const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://canteen_db_u14m_user:DvkEic4L0ujvjotonWj8h5YmjS7Mh1k0@dpg-d8qrr7j6sc1c73aeh9lg-a.singapore-postgres.render.com/canteen_db_u14m?sslmode=require"
    }
  }
});

async function main() {
  const phone = '8134011875';
  
  const user = await prisma.user.findFirst({
    where: { phone }
  });

  if (!user) {
    console.log('User not found with phone:', phone);
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'SUPER_ADMIN' }
  });

  console.log(`Successfully upgraded ${updatedUser.name} (${updatedUser.phone}) to SUPER_ADMIN!`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
