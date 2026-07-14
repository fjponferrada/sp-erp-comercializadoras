import { prisma } from '../src/lib/prisma';

async function main() {
  const brandId = 'cmq6j25ko0000d44130cfn6oz';
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  const countOriginal = await prisma.invoice.count({
    where: {
      companyId: brand?.companyId,
      issueDate: {
        gte: new Date(2026, 3, 1),
        lte: new Date(2026, 5, 31)
      }
    }
  });

  const countSplit = await prisma.invoice.count({
    where: {
      companyId: brand?.companyId,
      issueDate: {
        gte: new Date('2026-04-01'),
        lte: new Date('2026-06-30')
      }
    }
  });

  console.log(`Original count: ${countOriginal}`);
  console.log(`Split count: ${countSplit}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
