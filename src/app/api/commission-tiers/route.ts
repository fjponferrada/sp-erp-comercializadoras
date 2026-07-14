import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tiers = await prisma.commissionTier.findMany({
      include: {
        rules: { include: { products: { select: { id: true } }, additionalServices: { select: { id: true } } } },
        channels: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(tiers);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const newTier = await prisma.commissionTier.create({
      data: {
        name: data.name,
        description: data.description || null
      }
    });

    if (data.copyFromId) {
      const sourceRules = await prisma.commissionRule.findMany({
        where: { tierId: data.copyFromId },
        include: { products: true, additionalServices: true }
      });

      for (const rule of sourceRules) {
        await prisma.commissionRule.create({
          data: {
            tierId: newTier.id,
            tariff: rule.tariff,
            productType: rule.productType,
            powerMin: rule.powerMin,
            powerMax: rule.powerMax,
            commissionType: rule.commissionType,
            value: rule.value,
            products: { connect: rule.products.map(p => ({ id: p.id })) },
            additionalServices: { connect: rule.additionalServices.map(s => ({ id: s.id })) }
          }
        });
      }
    }

    return NextResponse.json(newTier);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
