import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBrandAccessContext } from '@/lib/permissions';

function toNullableFloat(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await getBrandAccessContext();
    if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    if (!access.canAccessBrand(existingProduct.brandId)) {
      return NextResponse.json({ error: 'Sin acceso autorizado sobre la marca de este producto' }, { status: 403 });
    }

    const data = await req.json();
    if (!data.name || !String(data.name).trim()) {
      return NextResponse.json({ error: 'El nombre del producto es obligatorio' }, { status: 400 });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: String(data.name).trim(),
        type: data.type ? String(data.type).trim() : existingProduct.type,
        tariff: data.tariff ? String(data.tariff).trim() : null,
        isAvailableCrm: data.isAvailableCrm ?? existingProduct.isAvailableCrm,
        isAvailableWeb:
          data.isAvailableWeb !== undefined ? Boolean(data.isAvailableWeb) : existingProduct.isAvailableWeb,
        isCustomizable: Boolean(data.isCustomizable),
        pricingModel: data.pricingModel || existingProduct.pricingModel,
        permanenceMonths:
          data.permanenceMonths !== undefined && data.permanenceMonths !== ''
            ? Number(data.permanenceMonths)
            : null,

        hasSelfConsumption: Boolean(data.hasSelfConsumption),
        selfConsumptionType: data.selfConsumptionType || 'No aplica',
        pexc: toNullableFloat(data.pexc),
        feeExcedentes: toNullableFloat(data.feeExcedentes),
        cgBolsilloSolar: toNullableFloat(data.cgBolsilloSolar),

        fee: toNullableFloat(data.fee),
        deviationCost: toNullableFloat(data.deviationCost),
        commissionType: data.commissionType || existingProduct.commissionType,

        p1p: toNullableFloat(data.p1p),
        p2p: toNullableFloat(data.p2p),
        p3p: toNullableFloat(data.p3p),
        p4p: toNullableFloat(data.p4p),
        p5p: toNullableFloat(data.p5p),
        p6p: toNullableFloat(data.p6p),

        p1e: toNullableFloat(data.p1e),
        p2e: toNullableFloat(data.p2e),
        p3e: toNullableFloat(data.p3e),
        p4e: toNullableFloat(data.p4e),
        p5e: toNullableFloat(data.p5e),
        p6e: toNullableFloat(data.p6e),

        marginFC: toNullableFloat(data.marginFC),
        ip1: toNullableFloat(data.ip1),
        ip2: toNullableFloat(data.ip2),
        ip3: toNullableFloat(data.ip3),
        ip4: toNullableFloat(data.ip4),
        ip5: toNullableFloat(data.ip5),
        ip6: toNullableFloat(data.ip6),
      },
    });

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno al actualizar el producto' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await getBrandAccessContext();
    if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { contracts: true },
        },
      },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    if (!access.canAccessBrand(existingProduct.brandId)) {
      return NextResponse.json({ error: 'Sin acceso autorizado sobre la marca de este producto' }, { status: 403 });
    }

    if (existingProduct._count.contracts > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar este producto porque tiene ${existingProduct._count.contracts} contrato(s) vinculado(s). Desmarca "Disponible en CRM" y "Visible en Web Pública" para archivarlo sin perder el histórico.`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: {
          channels: { set: [] },
          commissionRules: { set: [] },
        },
      }),
      prisma.product.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno al eliminar el producto' }, { status: 500 });
  }
}
