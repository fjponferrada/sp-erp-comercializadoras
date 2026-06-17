const { prisma } = require('./src/lib/prisma.ts');

async function main() {
  const sps = await prisma.supplyPoint.findMany({
    where: { cups: 'ES0031101402139001ZV0F' },
    include: {
      client: {
        include: {
          brand: true
        }
      },
      contracts: true
    }
  });

  console.log(JSON.stringify(sps.map(sp => ({
    id: sp.id,
    cups: sp.cups,
    clientId: sp.clientId,
    clientName: sp.client.businessName || sp.client.firstName,
    brandName: sp.client.brand.name,
    annualConsumption: sp.annualConsumption,
    contractCount: sp.contracts.length,
    contracts: sp.contracts.map(c => c.status)
  })), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
