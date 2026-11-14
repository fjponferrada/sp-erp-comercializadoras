import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  listRegulatorySubmissions,
  requireRegulatoryContext,
} from '@/lib/regulacionServer';

export async function GET(request: Request) {
  try {
    const authRes = await requireRegulatoryContext();
    if (!authRes.ok) return authRes.response;
    const { ctx } = authRes;

    const { searchParams } = new URL(request.url);
    const catParam = searchParams.get('category');
    const category =
      catParam === 'CNMC' || catParam === 'MITECO' ? catParam : undefined;

    const submissions = await listRegulatorySubmissions(ctx.companyId, category, 50);

    // Calcular siguiente versión correlativa sugerida por periodo para SI_CODAGE (01, 02, 03...)
    const suggestedVersions: Record<string, string> = {};
    for (const sub of submissions) {
      if (sub.reportType === 'SI_CODAGE' && sub.period) {
        const currentMax = parseInt(suggestedVersions[sub.period] || '0', 10);
        const subVer = parseInt(sub.version || '1', 10);
        // Si ya hubo una entrega presentada o generada, sugerimos la siguiente correlativa al presentar corrección
        const candidate = sub.status === 'SUBMITTED' ? subVer + 1 : subVer;
        if (candidate > currentMax) {
          suggestedVersions[sub.period] = String(Math.min(99, candidate)).padStart(2, '0');
        }
      }
    }

    return NextResponse.json({
      company: {
        id: ctx.company.id,
        name: ctx.company.name,
        cif: ctx.company.cif,
        ordenCnmc: ctx.codigoAgente,
        codigoRee: ctx.company.codigoRee,
        brandsCount: ctx.company.brands.length,
        brands: ctx.company.brands,
      },
      submissions,
      suggestedVersions,
    });
  } catch (error: any) {
    console.error('Error fetching regulatory submissions:', error);
    return NextResponse.json(
      { error: error.message || 'Error cargando contexto regulatorio' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authRes = await requireRegulatoryContext();
    if (!authRes.ok) return authRes.response;
    const { ctx } = authRes;

    const body = await request.json();
    const { id, status, receiptUrl, receiptName, notes } = body || {};

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Falta el identificador del registro' }, { status: 400 });
    }

    const existing = await prisma.syncJob.findUnique({ where: { id } });
    if (
      !existing ||
      existing.type !== 'REGULATORY_SUBMISSION' ||
      existing.companyId !== ctx.companyId
    ) {
      return NextResponse.json({ error: 'Registro no encontrado o sin acceso' }, { status: 404 });
    }

    const prevResults = ((existing.results || {}) as Record<string, any>);
    const nextStatus = status === 'SUBMITTED' || status === 'GENERATED' ? status : existing.status;

    const updatedResults = {
      ...prevResults,
      receiptUrl: receiptUrl !== undefined ? receiptUrl : prevResults.receiptUrl ?? null,
      receiptName: receiptName !== undefined ? receiptName : prevResults.receiptName ?? null,
      notes: notes !== undefined ? notes : prevResults.notes ?? null,
      submittedAt:
        nextStatus === 'SUBMITTED'
          ? prevResults.submittedAt || new Date().toISOString()
          : null,
      submittedBy: nextStatus === 'SUBMITTED' ? ctx.userName : prevResults.submittedBy ?? null,
    };

    await prisma.syncJob.update({
      where: { id },
      data: {
        status: nextStatus,
        results: updatedResults,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating regulatory submission:', error);
    return NextResponse.json(
      { error: error.message || 'Error actualizando registro regulatorio' },
      { status: 500 }
    );
  }
}
