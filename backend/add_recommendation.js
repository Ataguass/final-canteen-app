const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const item = await prisma.menuItem.findFirst({
    where: {
      isTodaySpecial: false,
      isAvailable: true,
      stockQty: { gt: 0 }
    }
  });

  if (item) {
    const updated = await prisma.menuItem.update({
      where: { id: item.id },
      data: { isTodaySpecial: true }
    });
    console.log(`Successfully added '${updated.name}' to the recommended section (isTodaySpecial set to true).`);
  } else {
    // If no available item exists, let's just create one!
    const cat = await prisma.category.findFirst();
    if (cat) {
      const newItem = await prisma.menuItem.create({
        data: {
          tenantId: cat.tenantId,
          categoryId: cat.id,
          name: "Crispy Samosa",
          description: "Hot and crispy samosa",
          price: 15,
          stockQty: 50,
          isAvailable: true,
          isTodaySpecial: true,
          image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=400"
        }
      });
      console.log(`Created new item '${newItem.name}' and added it to the recommended section.`);
    } else {
      console.log("No categories found to create an item.");
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
