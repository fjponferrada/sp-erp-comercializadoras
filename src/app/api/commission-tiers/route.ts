import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeBrandId = await getActiveBrand();
    if (!activeBrandId) {
      return NextResponse.json({ error: 'Marca no seleccionada' }, { status: 400 });
    }

    const tiers = await prisma.commissionTier.findMany({
      where: { brandId: activeBrandId },
      include: {
        rules: {
          include: {
            products: { select: { id: true } },
            additionalServices: { select: { id: true } },
          },
        },
        channels: {
          where: { brandId: activeBrandId },
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
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

    const activeBrandId = await getActiveBrand();
    if (!activeBrandId) {
      return NextResponse.json({ error: 'Marca no seleccionada' }, { status: 400 });
    }

    const data = await req.json();
    const cleanName = String(data.name || '').trim();
    if (!cleanName) {
      return NextResponse.json({ error: 'El nombre del nivel es obligatorio' }, { status: 400 });
    }

    const duplicate = await prisma.commissionTier.findFirst({
      where: { name: { equals: cleanName, mode: 'insensitive' }, brandId: activeBrandId },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Ya existe un nivel con ese nombre en esta marca' }, { status: 409 });
    }

    const newTier = await prisma.commissionTier.create({
      data: {
        name: cleanName,
        description: data.description || null,
        brandId: activeBrandId,
      },
    });

    if (data.copyFromId) {
      const sourceTier = await prisma.commissionTier.findFirst({
        where: { id: data.copyFromId, brandId: activeBrandId },
      });

      if (sourceTier) {
        const sourceRules = await prisma.commissionRule.findMany({
          where: { tierId: sourceTier.id },
          include: { products: true, additionalServices: true },
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
              products: { connect: rule.products.map((p) => ({ id: p.id })) },
              additionalServices: { connect: rule.additionalServices.map((s) => ({ id: s.id })) },
            },
          });
        }
      }
    }

    return NextResponse.json(newTier);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
