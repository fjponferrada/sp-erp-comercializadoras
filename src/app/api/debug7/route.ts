import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const targetProduct = await prisma.product.findFirst({
      where: { name: 'ERANOVUM BOE Index' }
    });

    if (!targetProduct) return NextResponse.json({ error: "Product not found" });

    const contracts = await prisma.contract.findMany({
      where: {
        status: 'ACTIVO',
        client: {
          businessName: { contains: 'eranovum', mode: 'insensitive' }
        },
        supplyPoint: {
          tariff: { contains: '3.0TDVE', mode: 'insensitive' }
        }
      },
      include: {
        client: true,
        supplyPoint: true,
        product: true
      }
    });

    let updatedCount = 0;
    const details = [];
    for (const contract of contracts) {
      if (contract.productId !== targetProduct.id) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            productId: targetProduct.id,
            pricingModel: targetProduct.pricingModel
          }
        });
        updatedCount++;
        details.push(`Updated contract ${contract.id} (CUPS: ${contract.supplyPoint?.cups})`);
      }
    }

    return NextResponse.json({ updatedCount, details });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
