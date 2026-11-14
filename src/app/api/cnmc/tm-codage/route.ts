import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { resolveActiveCompanyId } from '@/lib/companyContext';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const userRole = (session.user as any).role || 'CANAL';
    if (['COMERCIAL', 'CANAL'].includes(userRole)) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes'); // e.g. "2026-04"

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: 'Falta o es inválido el parámetro mes (YYYY-MM)' }, { status: 400 });
    }

    const [yearStr, monthStr] = mes.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // Calculate Quarter based on the given month
    const quarter = Math.ceil(month / 3);
    const qStartMonth = (quarter - 1) * 3 + 1;
    const qEndMonth = quarter * 3;

    // JS dates are 0-indexed for months
    const startDate = new Date(year, qStartMonth - 1, 1);
    const endDate = new Date(year, qEndMonth, 1); // 1st of next month after quarter

    const activeCompanyId = await resolveActiveCompanyId(session);
    const company = activeCompanyId
      ? await prisma.company.findUnique({ where: { id: activeCompanyId } })
      : await prisma.company.findFirst();

    if (!company) {
      return NextResponse.json({ error: 'No se encontró información de la empresa comercializadora' }, { status: 500 });
    }

    const codigoAgente = company.ordenCnmc || 'R2-950';

    const companyScopeOr: any[] = [
      { contract: { brand: { companyId: company.id } } },
      { supplyPoint: { client: { brand: { companyId: company.id } } } },
    ];
    if (company.codigoRee) {
      companyScopeOr.push({ uniqueProcess: { startsWith: `${company.codigoRee}_` } });
    }

    // Fetch Switching Events for the quarter scoped to active company
    const events = await prisma.switchingEvent.findMany({
      where: {
        fechaSolicitud: {
          gte: startDate,
          lt: endDate,
        },
        procesoBase: {
          in: ['C1', 'C2'], // C1 sin actuacion, C2 con actuacion
        },
        OR: companyScopeOr,
      },
    });

    // Group by codigoSolicitud
    const eventsByReq: Record<string, typeof events> = {};
    for (const e of events) {
      if (!e.codigoSolicitud) continue;
      if (!eventsByReq[e.codigoSolicitud]) eventsByReq[e.codigoSolicitud] = [];
      eventsByReq[e.codigoSolicitud].push(e);
    }

    const resultGroup: Record<string, { sumDays: number; count: number }> = {};

    for (const reqId in eventsByReq) {
      const pasos = eventsByReq[reqId];
      const pasoInicial = pasos.find(p => p.paso === '01');
      const pasoActivado = pasos.find(p => p.paso === '05' || p.fechaActivacionAlta);

      if (!pasoInicial || !pasoActivado || !pasoInicial.fechaSolicitud) continue;

      // Ensure it is not rejected or annulled
      const isRechazado = pasos.some(p => p.estadoAR?.includes('RECHAZ') || p.paso === '04' || p.isAnnulled);
      if (isRechazado) continue;

      const dateActivacion = pasoActivado.fechaActivacionAlta || pasoActivado.fechaAR;
      const diffDays = dateActivacion
        ? Math.max(0, (dateActivacion.getTime() - pasoInicial.fechaSolicitud.getTime()) / (1000 * 3600 * 24))
        : 0;

      let actuacionCampo = '0';
      const pasoActuacion = pasos.find(p => p.actuacionCampo !== null && p.actuacionCampo !== undefined);
      if (pasoActuacion) {
        actuacionCampo = pasoActuacion.actuacionCampo ? '1' : '0';
      } else {
        actuacionCampo = pasoInicial.procesoBase === 'C2' ? '1' : '0';
      }

      const canal = 'P';
      const indActivacion = 'A';

      const key = `${canal};${actuacionCampo};${indActivacion}`;
      if (!resultGroup[key]) resultGroup[key] = { sumDays: 0, count: 0 };

      resultGroup[key].sumDays += diffDays;
      resultGroup[key].count++;
    }

    // Build CSV Content
    let csv = `CANAL;ActuacionCampo;IndActivacion;NumActivada;TiempoMedio\n`;
    for (const key in resultGroup) {
      const group = resultGroup[key];
      const avg = (group.sumDays / group.count).toFixed(2);
      csv += `${key};${group.count};${avg}\n`;
    }

    const filename = `TM_${codigoAgente}_${year}T${quarter}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generando TM_CODAGE:', error);
    return NextResponse.json({ error: 'Error interno generando TM Codage' }, { status: 500 });
  }
}
