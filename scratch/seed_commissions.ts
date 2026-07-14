import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('--- Seeding Commission Tiers and Rules ---');

  const tiersData = [
    {
      name: 'Nivel 1',
      rules: [
        { productType: 'Fijo', commissionType: 'PERCENTAGE', value: 70 },
        { productType: 'Index', commissionType: 'PERCENTAGE', value: 80 },
        { productType: 'Fijo', tariff: '2.0TD', powerMin: 0, powerMax: 5, commissionType: 'FIXED', value: 105 },
        { productType: 'Fijo', tariff: '2.0TD', powerMin: 5, powerMax: 10, commissionType: 'FIXED', value: 160 },
        { productType: 'Fijo', tariff: '2.0TD', powerMin: 10, powerMax: 15, commissionType: 'FIXED', value: 255 },
      ]
    },
    {
      name: 'Nivel 2',
      rules: [
        { productType: 'Fijo', commissionType: 'PERCENTAGE', value: 65 },
        { productType: 'Index', commissionType: 'PERCENTAGE', value: 75 },
        { productType: 'Fijo', tariff: '2.0TD', powerMin: 0, powerMax: 5, commissionType: 'FIXED', value: 90 },
        { productType: 'Fijo', tariff: '2.0TD', powerMin: 5, powerMax: 10, commissionType: 'FIXED', value: 135 },
        { productType: 'Fijo', tariff: '2.0TD', powerMin: 10, powerMax: 15, commissionType: 'FIXED', value: 235 },
      ]
    },
    {
      name: 'Nivel 3',
      rules: [
        { productType: 'Fijo', commissionType: 'PERCENTAGE', value: 50 },
        { productType: 'Index', commissionType: 'PERCENTAGE', value: 60 },
        { productType: 'Fijo', tariff: '2.0TD', powerMin: 0, powerMax: 5, commissionType: 'FIXED', value: 85 },
        { productType: 'Fijo', tariff: '2.0TD', powerMin: 5, powerMax: 10, commissionType: 'FIXED', value: 120 },
        { productType: 'Fijo', tariff: '2.0TD', powerMin: 10, powerMax: 15, commissionType: 'FIXED', value: 180 },
      ]
    }
  ];

  // 1. Create Tiers and Rules
  for (const t of tiersData) {
    let tier = await prisma.commissionTier.findUnique({ where: { name: t.name } });
    if (!tier) {
      tier = await prisma.commissionTier.create({ data: { name: t.name } });
      console.log(`Created Tier: ${t.name}`);
    } else {
      // Clean old rules
      await prisma.commissionRule.deleteMany({ where: { tierId: tier.id } });
    }

    for (const r of t.rules) {
      await prisma.commissionRule.create({
        data: {
          tierId: tier.id,
          productType: r.productType || null,
          tariff: r.tariff || null,
          powerMin: r.powerMin !== undefined ? r.powerMin : null,
          powerMax: r.powerMax !== undefined ? r.powerMax : null,
          commissionType: r.commissionType,
          value: r.value
        }
      });
    }
    console.log(`Created rules for Tier: ${t.name}`);
  }

  // 2. Assign channels
  const channels = await prisma.channel.findMany();
  const tier1 = await prisma.commissionTier.findUnique({ where: { name: 'Nivel 1' } });
  const tier2 = await prisma.commissionTier.findUnique({ where: { name: 'Nivel 2' } });
  const tier3 = await prisma.commissionTier.findUnique({ where: { name: 'Nivel 3' } });

  for (const c of channels) {
    const nameLower = c.name.toLowerCase();
    let assignedTierId = tier3?.id; // default Nivel 3

    if (nameLower.includes('pablo remacha')) {
      assignedTierId = tier1?.id;
    } else if (nameLower.includes('nur') || nameLower.includes('ochoa') || nameLower.includes('tricolor')) {
      assignedTierId = tier2?.id;
    }

    if (assignedTierId) {
      await prisma.channel.update({
        where: { id: c.id },
        data: { commissionTierId: assignedTierId }
      });
      console.log(`Assigned channel ${c.name} to tier ${assignedTierId}`);
    }
  }

  console.log('Seeding completed successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
