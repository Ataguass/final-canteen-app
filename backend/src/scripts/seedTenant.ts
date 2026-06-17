import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'karimganj-college' },
    update: {},
    create: {
      name: 'Karimganj College',
      slug: 'karimganj-college',
      primaryColor: '#080d2b',
    },
  });
  console.log('Tenant seeded:', tenant);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
