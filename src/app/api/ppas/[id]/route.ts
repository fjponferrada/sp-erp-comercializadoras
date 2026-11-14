import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import {
  parseMadridEndOfDay,
  parseMadridStartOfDay,
  toMadridYmd,
  validateProfileMatrix,
} from '@/lib/ppaEngine';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Solo Administración o Backoffice pueden eliminar PPAs.' },
        { status: 403 }
      );
    }

    const companyId = await resolveActiveCompanyId(session);
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa activa no encontrada' }, { status: 404 });
    }

    const ppa = await prisma.ppa.findUnique({ where: { id } });
    if (!ppa || ppa.companyId !== companyId) {
      return NextResponse.json({ error: 'PPA no encontrado o no tienes permiso' }, { status: 404 });
    }

    await prisma.ppa.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error DELETE /api/ppas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Solo Administración o Backoffice pueden editar PPAs.' },
        { status: 403 }
      );
    }

    const companyId = await resolveActiveCompanyId(session);
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa activa no encontrada' }, { status: 404 });
    }

    const ppa = await prisma.ppa.findUnique({ where: { id } });
    if (!ppa || ppa.companyId !== companyId) {
      return NextResponse.json({ error: 'PPA no encontrado o no tienes permiso' }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      counterparty,
      type,
      subtype,
      startDate,
      endDate,
      priceType,
      priceValue,
      basePowerMw,
      profileData,
      annualDegradationPct,
      annualEscalationPct,
      contractPdfUrl,
      notes,
      includeInPricing,
    } = body;

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || !type || !subtype || !startDate || !priceType) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    if (!['FISICO', 'FINANCIERO'].includes(type)) {
      return NextResponse.json({ error: 'Tipo de PPA inválido' }, { status: 400 });
    }
    if (!['CARGA_BASE', 'PERFIL_FIJO'].includes(subtype)) {
      return NextResponse.json({ error: 'Subtipo de PPA inválido' }, { status: 400 });
    }
    if (!['FIJO', 'INDEXADO'].includes(priceType)) {
      return NextResponse.json({ error: 'Tipo de precio inválido' }, { status: 400 });
    }

    const parsedStart = parseMadridStartOfDay(String(startDate));
    const parsedEnd = endDate ? parseMadridEndOfDay(String(endDate)) : null;

    const startYmd = toMadridYmd(parsedStart)!;
    const endYmd = parsedEnd ? toMadridYmd(parsedEnd)! : null;
    if (endYmd && endYmd < startYmd) {
      return NextResponse.json(
        { error: 'La fecha de fin no puede ser anterior a la fecha de inicio.' },
        { status: 400 }
      );
    }

    const parsedPriceValue =
      priceValue !== null && priceValue !== undefined && String(priceValue).trim() !== ''
        ? Number(String(priceValue).replace(',', '.'))
        : 0;
    if (!Number.isFinite(parsedPriceValue)) {
      return NextResponse.json({ error: 'El valor de precio / fee no es numérico.' }, { status: 400 });
    }
    if (priceType === 'FIJO' && parsedPriceValue < 0) {
      return NextResponse.json({ error: 'Un precio fijo (Strike) no puede ser negativo.' }, { status: 400 });
    }

    let parsedBasePowerMw: number | null = null;
    let normalizedProfile: number[][] | typeof Prisma.DbNull = Prisma.DbNull;

    if (subtype === 'CARGA_BASE') {
      parsedBasePowerMw =
        basePowerMw !== null && basePowerMw !== undefined && String(basePowerMw).trim() !== ''
          ? Number(String(basePowerMw).replace(',', '.'))
          : NaN;
      if (!Number.isFinite(parsedBasePowerMw) || parsedBasePowerMw <= 0) {
        return NextResponse.json(
          { error: 'Carga Base requiere una potencia mayor que 0 MW.' },
          { status: 400 }
        );
      }
    } else if (subtype === 'PERFIL_FIJO') {
      const check = validateProfileMatrix(profileData);
      if (!check.valid || !check.normalized) {
        return NextResponse.json(
          { error: check.error || 'Perfil Fijo requiere una matriz 12x24 válida.' },
          { status: 400 }
        );
      }
      normalizedProfile = check.normalized;
    }

    const parsedDegradation =
      annualDegradationPct !== null && annualDegradationPct !== undefined && String(annualDegradationPct).trim() !== ''
        ? Number(String(annualDegradationPct).replace(',', '.'))
        : 0;
    const parsedEscalation =
      annualEscalationPct !== null && annualEscalationPct !== undefined && String(annualEscalationPct).trim() !== ''
        ? Number(String(annualEscalationPct).replace(',', '.'))
        : 0;

    if (!Number.isFinite(parsedDegradation) || parsedDegradation < 0 || parsedDegradation > 25) {
      return NextResponse.json(
        { error: 'La degradación anual debe estar entre 0% y 25%.' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(parsedEscalation) || parsedEscalation < -25 || parsedEscalation > 50) {
      return NextResponse.json(
        { error: 'La indexación/escalado anual debe estar entre -25% y 50%.' },
        { status: 400 }
      );
    }

    const updatedPpa = await prisma.ppa.update({
      where: { id },
      data: {
        name: cleanName,
        counterparty: counterparty !== undefined ? (String(counterparty).trim() || null) : ppa.counterparty,
        type,
        subtype,
        startDate: parsedStart,
        endDate: parsedEnd,
        priceType,
        priceValue: parsedPriceValue,
        basePowerMw: parsedBasePowerMw,
        profileData: normalizedProfile,
        annualDegradationPct: parsedDegradation,
        annualEscalationPct: parsedEscalation,
        contractPdfUrl: contractPdfUrl !== undefined ? (contractPdfUrl ? String(contractPdfUrl).trim() : null) : ppa.contractPdfUrl,
        notes: notes !== undefined ? (notes ? String(notes).trim() : null) : ppa.notes,
        includeInPricing: includeInPricing !== undefined ? Boolean(includeInPricing) : ppa.includeInPricing,
      },
    });

    return NextResponse.json(updatedPpa);
  } catch (error: any) {
    console.error('Error PUT /api/ppas/[id]:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes.' },
        { status: 403 }
      );
    }

    const companyId = await resolveActiveCompanyId(session);
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa activa no encontrada' }, { status: 404 });
    }

    const ppa = await prisma.ppa.findUnique({ where: { id } });
    if (!ppa || ppa.companyId !== companyId) {
      return NextResponse.json({ error: 'PPA no encontrado o no tienes permiso' }, { status: 404 });
    }

    const body = await req.json();
    const updated = await prisma.ppa.update({
      where: { id },
      data: {
        includeInPricing:
          body.includeInPricing !== undefined ? Boolean(body.includeInPricing) : ppa.includeInPricing,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error PATCH /api/ppas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
