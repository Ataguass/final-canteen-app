import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const college = await prisma.tenant.upsert({
    where: { slug: 'karimganj-college' },
    update: {},
    create: {
      name: 'Karimganj College',
      slug: 'karimganj-college',
      schoolCode: 'KCJ',
      primaryColor: '#005A9C',
    },
  });
  console.log('Upserted tenant:', college);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
