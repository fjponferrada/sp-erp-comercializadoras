import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes'); // e.g. "2026-04"

    if (!mes) {
      return NextResponse.json({ error: 'Falta el parámetro mes' }, { status: 400 });
    }

    const [yearStr, monthStr] = mes.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    // Calculate Quarter based on the given month
    const quarter = Math.ceil(month / 3);
    const qStartMonth = (quarter - 1) * 3 + 1;
    const qEndMonth = quarter * 3;
    
    // JS dates are 0-indexed for months
    const startDate = new Date(year, qStartMonth - 1, 1);
    const endDate = new Date(year, qEndMonth, 1); // 1st of next month after quarter

    // Get Brand/Company details (Assuming the user operates from their primary brand)
    const brand = await prisma.brand.findFirst({
      include: { company: true }
    });

    if (!brand || !brand.company) {
      return NextResponse.json({ error: 'No se encontró información de la empresa comercializadora' }, { status: 500 });
    }

    const codigoAgente = brand.company.ordenCnmc || 'R2-950'; // Defaulting to AED's if missing

    // Fetch Switching Events for the quarter
    const events = await prisma.switchingEvent.findMany({
      where: {
        fechaSolicitud: {
          gte: startDate,
          lt: endDate,
        },
        procesoBase: {
          in: ['C1', 'C2'] // C1 sin actuacion, C2 con actuacion
        }
      }
    });

    // Group by codigoSolicitud
    const eventsByReq: Record<string, typeof events> = {};
    for (const e of events) {
      if (!e.codigoSolicitud) continue;
      if (!eventsByReq[e.codigoSolicitud]) eventsByReq[e.codigoSolicitud] = [];
      eventsByReq[e.codigoSolicitud].push(e);
    }

    let resultGroup: Record<string, { sumDays: number, count: number }> = {};

    for (const reqId in eventsByReq) {
      const pasos = eventsByReq[reqId];
      const pasoInicial = pasos.find(p => p.paso === '01');
      const pasoActivado = pasos.find(p => p.paso === '05' || p.fechaActivacionAlta);
      
      if (!pasoInicial || !pasoActivado || !pasoInicial.fechaSolicitud) continue;

      // Ensure it is not rejected
      const isRechazado = pasos.some(p => p.estadoAR === 'RECHAZADO' || p.tipoError);
      if (isRechazado) continue;

      const dateActivacion = pasoActivado.fechaActivacionAlta || pasoActivado.fechaAR;
      const diffDays = dateActivacion ? Math.max(0, (dateActivacion.getTime() - pasoInicial.fechaSolicitud.getTime()) / (1000 * 3600 * 24)) : 0;

      // ActuacionCampo: 
      // Buscar si algún paso (ej. paso 02) guardó explícitamente el actuacionCampo
      let actuacionCampo = '0';
      const pasoActuacion = pasos.find(p => p.actuacionCampo !== null && p.actuacionCampo !== undefined);
      if (pasoActuacion) {
        actuacionCampo = pasoActuacion.actuacionCampo ? '1' : '0';
      } else {
        // Fallback: C1 -> 0, C2 -> 1
        actuacionCampo = pasoInicial.procesoBase === 'C2' ? '1' : '0';
      }

      // Canal (Opción 1: Hardcoded P como solicitó el usuario)
      const canal = 'P';

      // Indicador Activacion (Opción 1: Hardcoded A como solicitó el usuario)
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
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error: any) {
    console.error('Error generando TM_CODAGE:', error);
    return NextResponse.json({ error: 'Error interno generando TM Codage' }, { status: 500 });
  }
}
