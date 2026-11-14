import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import {
  parseMadridEndOfDay,
  parseMadridStartOfDay,
  toMadridYmd,
  validateProfileMatrix,
} from '@/lib/ppaEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = await resolveActiveCompanyId(session);
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa activa no encontrada' }, { status: 404 });
    }

    const ppas = await prisma.ppa.findMany({
      where: { companyId },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });

    const { searchParams } = new URL(req.url);
    if (searchParams.get('withMeta') === '1') {
      const latestCurve = await prisma.portfolioBaseCurve.findFirst({
        where: { companyId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      });
      const fallbackCurve = !latestCurve
        ? await prisma.portfolioBaseCurve.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
          })
        : null;

      return NextResponse.json({
        ppas,
        canManage: hasAdminOrBackofficeRole((session.user as any).role),
        lastPortfolioSyncAt: (latestCurve ?? fallbackCurve)?.updatedAt ?? null,
        companyId,
      });
    }

    return NextResponse.json(ppas);
  } catch (error: any) {
    console.error('Error GET /api/ppas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Solo Administración o Backoffice pueden crear PPAs.' },
        { status: 403 }
      );
    }

    const companyId = await resolveActiveCompanyId(session);
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa activa no encontrada' }, { status: 404 });
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
    let normalizedProfile: number[][] | null = null;

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

    const newPpa = await prisma.ppa.create({
      data: {
        name: cleanName,
        companyId,
        counterparty: counterparty ? String(counterparty).trim() || null : null,
        type,
        subtype,
        startDate: parsedStart,
        endDate: parsedEnd,
        priceType,
        priceValue: parsedPriceValue,
        basePowerMw: parsedBasePowerMw,
        profileData: normalizedProfile ?? undefined,
        annualDegradationPct: parsedDegradation,
        annualEscalationPct: parsedEscalation,
        contractPdfUrl: contractPdfUrl ? String(contractPdfUrl).trim() || null : null,
        notes: notes ? String(notes).trim() || null : null,
        includeInPricing: includeInPricing !== undefined ? Boolean(includeInPricing) : true,
      },
    });

    return NextResponse.json(newPpa);
  } catch (error: any) {
    console.error('Error POST /api/ppas:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
