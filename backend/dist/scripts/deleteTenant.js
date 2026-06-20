import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const tenants = await prisma.tenant.findMany({
        where: {
            name: { contains: 'Karimganj' }
        }
    });
    const emptyOne = tenants.find(t => t.id === 'cmqcqvmy60000kx6wfbn0jdd6');
    const establishedOne = tenants.find(t => t.id === 'cmq9cvyeg0000kx6c9l1yirv4');
    if (emptyOne) {
        await prisma.tenant.delete({
            where: { id: emptyOne.id }
        });
        console.log('Deleted empty duplicate tenant');
    }
    if (establishedOne) {
        const updated = await prisma.tenant.update({
            where: { id: establishedOne.id },
            data: { name: 'Karimganj College' }
        });
        console.log('Renamed established tenant to:', updated.name);
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
