import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { parseMadridStartOfDay, toMadridYmd } from '@/lib/ppaEngine';
import {
  buildSwitchingCompanyWhere,
  daysBetweenMadridDates,
  isDateInMadridRange,
  logRegulatoryGeneration,
  requireRegulatoryContext,
} from '@/lib/regulacionServer';

/**
 * Deriva el código CANAL oficial CNMC (Apdo. 6.2 Manual SCC v6.0):
 * - 'P': Presencial no domiciliario (valor válido verificado en histórico CNMC; 'R' fue rechazado en 2024T3)
 * - 'D': Presencial domiciliario (visita a domicilio)
 * - 'T': Telefónico
 * - 'O': Online / Web / Telemático
 */
function resolveCnmcCanal(contract: any): 'P' | 'D' | 'T' | 'O' {
  const candidates = [
    contract?.Lead?.source,
    contract?.user?.defaultSource,
    contract?.user?.channel?.name,
  ]
    .filter(Boolean)
    .map(s => String(s).toUpperCase());

  for (const text of candidates) {
    if (text.includes('ONLINE') || text.includes('WEB') || text.includes('PORTAL') || text.includes('DIGITAL')) {
      return 'O';
    }
    if (text.includes('TELEF') || text.includes('CALL') || text.includes('TLF')) {
      return 'T';
    }
    if (text.includes('DOMICILI') || text.includes('PUERTA A PUERTA')) {
      return 'D';
    }
  }
  return 'P';
}

/**
 * Deriva IND_ACTIVACION oficial CNMC (Apdo. 6.2 Manual SCC v6.0):
 * - 'A': En cuanto antes (por defecto)
 * - 'L': Con ciclo de lectura
 * - 'F': En fecha fija
 */
function resolveIndActivacion(contract: any): 'A' | 'L' | 'F' {
  const raw = `${contract?.tramitationType || ''} ${contract?.tipoC2 || ''}`.toUpperCase();
  if (raw.includes('CICLO') || raw.includes('LECTURA')) return 'L';
  if (raw.includes('FIJA') || Boolean(contract?.fechaPrevista)) return 'F';
  return 'A';
}

export async function GET(request: Request) {
  try {
    const authRes = await requireRegulatoryContext();
    if (!authRes.ok) return authRes.response;
    const { ctx } = authRes;

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const quarterParam = searchParams.get('quarter');
    const mesParam = searchParams.get('mes'); // Compatibilidad retroactiva YYYY-MM
    const format = (searchParams.get('format') || 'csv').toLowerCase() === 'xls' ? 'xls' : 'csv';
    const isPreview = searchParams.get('preview') === 'true';

    let year = 0;
    let quarter = 0;

    if (yearParam && quarterParam) {
      year = parseInt(yearParam, 10);
      quarter = parseInt(quarterParam.replace(/^T/i, ''), 10);
    } else if (mesParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam)) {
      const [yStr, mStr] = mesParam.split('-');
      year = parseInt(yStr, 10);
      quarter = Math.ceil(parseInt(mStr, 10) / 3);
    }

    if (!Number.isFinite(year) || year < 2020 || year > 2100 || ![1, 2, 3, 4].includes(quarter)) {
      return NextResponse.json(
        { error: 'Parámetros de periodo inválidos. Especifique year (AAAA) y quarter (1..4).' },
        { status: 400 }
      );
    }

    const qStartMonth = (quarter - 1) * 3 + 1;
    const qStartYmd = `${year}-${String(qStartMonth).padStart(2, '0')}-01`;
    const qEndYear = quarter === 4 ? year + 1 : year;
    const qEndMonth = quarter === 4 ? 1 : qStartMonth + 3;
    const qEndYmd = `${qEndYear}-${String(qEndMonth).padStart(2, '0')}-01`;

    // Ventana amplia hacia atrás (12 meses antes del inicio del trimestre) para localizar el paso 01 y contrato
    // de activaciones efectivas ocurridas dentro del trimestre
    const lookbackStartDate = parseMadridStartOfDay(`${year - 1}-${String(qStartMonth).padStart(2, '0')}-01`);
    const qEndExclusiveDate = parseMadridStartOfDay(qEndYmd);

    const events = await prisma.switchingEvent.findMany({
      where: {
        AND: [
          { procesoBase: { in: ['C1', 'C2'] } },
          buildSwitchingCompanyWhere(ctx.companyId, ctx.isSingleCompanyDeployment),
          {
            OR: [
              { fechaActivacionAlta: { gte: lookbackStartDate, lt: qEndExclusiveDate } },
              { fechaSolicitud: { gte: lookbackStartDate, lt: qEndExclusiveDate } },
              { fechaAR: { gte: lookbackStartDate, lt: qEndExclusiveDate } },
              { fechaAviso: { gte: lookbackStartDate, lt: qEndExclusiveDate } },
            ],
          },
        ],
      },
      include: {
        contract: {
          select: {
            id: true,
            signatureDate: true,
            requestDate: true,
            tramitationType: true,
            tipoC2: true,
            fechaPrevista: true,
            Lead: { select: { source: true } },
            user: {
              select: {
                defaultSource: true,
                channel: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const eventsByReq = new Map<string, typeof events>();
    for (const ev of events) {
      if (!ev.codigoSolicitud) continue;
      const list = eventsByReq.get(ev.codigoSolicitud);
      if (list) list.push(ev);
      else eventsByReq.set(ev.codigoSolicitud, [ev]);
    }

    const resultGroups: Record<
      string,
      {
        canal: 'P' | 'D' | 'T' | 'O';
        actuacionCampo: '0' | '1';
        indActivacion: 'A' | 'L' | 'F';
        sumDays: number;
        count: number;
      }
    > = {};

    let missingSignatureFallbackCount = 0;

    for (const [, rawPasos] of eventsByReq.entries()) {
      // Acotar eventos al final del trimestre (< qEndYmd)
      const pasos = rawPasos.filter(p => {
        const ts = p.fechaActivacionAlta || p.fechaAR || p.fechaSolicitud || p.fechaAviso;
        const ymd = toMadridYmd(ts);
        return Boolean(ymd && ymd < qEndYmd);
      });

      const pasoInicial = pasos.find(p => p.paso === '01');
      if (!pasoInicial) continue;

      // Excluir solicitudes rechazadas o anuladas usando includes('RECHAZ') (Regla 182)
      const isRejectedOrAnnulled = pasos.some(
        p =>
          Boolean(p.estadoAR?.toUpperCase().includes('RECHAZ')) ||
          p.paso === '04' ||
          p.isAnnulled
      );
      if (isRejectedOrAnnulled) continue;

      const pasoActivado = pasos.find(p => p.paso === '05' || Boolean(p.fechaActivacionAlta));
      if (!pasoActivado) continue;

      const dateActivacion =
        pasoActivado.fechaActivacionAlta || pasoActivado.fechaAR || pasoActivado.fechaSolicitud;
      // Apdo. 6.2 y 11.6 Manual CNMC: se declaran las solicitudes ACTIVADAS EFECTIVAMENTE en el trimestre
      if (!isDateInMadridRange(dateActivacion, qStartYmd, qEndYmd)) continue;

      const contract =
        pasoActivado.contract ||
        pasoInicial.contract ||
        pasos.find(p => p.contract)?.contract;

      // Apdo. 11.6 Manual CNMC: tiempo medio medido desde la fecha de consentimiento/firma del cliente (signatureDate)
      let consentDate = contract?.signatureDate || contract?.requestDate || null;
      if (!consentDate) {
        consentDate = pasoInicial.fechaSolicitud || pasoInicial.fechaAviso;
        missingSignatureFallbackCount++;
      }
      // Si por error de captura la firma es posterior a la activación, daysBetweenMadridDates acota a 0
      const diffDays = daysBetweenMadridDates(consentDate, dateActivacion);

      let actuacionCampo: '0' | '1' = pasoInicial.procesoBase === 'C2' ? '1' : '0';
      const pasoConActuacion = pasos.find(p => p.actuacionCampo !== null && p.actuacionCampo !== undefined);
      if (pasoConActuacion) {
        actuacionCampo = pasoConActuacion.actuacionCampo ? '1' : '0';
      }

      const canal = resolveCnmcCanal(contract);
      const indActivacion = resolveIndActivacion(contract);

      const key = `${canal}|${actuacionCampo}|${indActivacion}`;
      if (!resultGroups[key]) {
        resultGroups[key] = {
          canal,
          actuacionCampo,
          indActivacion,
          sumDays: 0,
          count: 0,
        };
      }
      resultGroups[key].sumDays += diffDays;
      resultGroups[key].count++;
    }

    const sortedRows = Object.values(resultGroups)
      .sort((a, b) =>
        `${a.canal}|${a.actuacionCampo}|${a.indActivacion}`.localeCompare(
          `${b.canal}|${b.actuacionCampo}|${b.indActivacion}`
        )
      )
      .map(g => {
        const avgNum = Number((g.sumDays / g.count).toFixed(2));
        return {
          canal: g.canal,
          actuacionCampo: Number(g.actuacionCampo),
          indActivacion: g.indActivacion,
          numActivadas: g.count,
          tiempoMedio: avgNum,
          tiempoMedioStr: avgNum.toFixed(2),
        };
      });

    const totalActivadas = sortedRows.reduce((acc, r) => acc + r.numActivadas, 0);
    const totalWeightedDays = sortedRows.reduce((acc, r) => acc + r.tiempoMedio * r.numActivadas, 0);
    const globalMeanDays = totalActivadas > 0 ? Number((totalWeightedDays / totalActivadas).toFixed(2)) : 0;

    const warnings: string[] = [];
    if (sortedRows.length === 0) {
      warnings.push(
        `No constan cambios de comercializador (C1/C2) con activación efectiva en ${year}T${quarter} para ${ctx.company.name}.`
      );
    }
    if (missingSignatureFallbackCount > 0) {
      warnings.push(
        `${missingSignatureFallbackCount} activación(es) no tenían fecha de firma contractual asociada en el ERP; se ha empleado como respaldo la fecha de solicitud ATR (paso 01).`
      );
    }

    const periodLabel = `${year}T${quarter}`;
    const ext = format === 'xls' ? 'xls' : 'csv';
    // Sin sufijo _01 (la CNMC rechaza sufijos de versión en TM_CODAGE)
    const filename = `TM_${ctx.codigoAgente}_${periodLabel}.${ext}`;

    const summary = {
      periodo: periodLabel,
      format,
      filas: sortedRows.length,
      totalActivadas,
      tiempoMedioGlobal: globalMeanDays,
      sinFechaFirma: missingSignatureFallbackCount,
    };

    if (isPreview) {
      return NextResponse.json({
        company: {
          name: ctx.company.name,
          cif: ctx.company.cif,
          codigoAgente: ctx.codigoAgente,
        },
        year,
        quarter,
        periodo: periodLabel,
        filename,
        emptyQuarter: sortedRows.length === 0,
        summary,
        warnings,
        rows: sortedRows,
      });
    }

    await logRegulatoryGeneration({
      companyId: ctx.companyId,
      category: 'CNMC',
      reportType: 'TM_CODAGE',
      period: periodLabel,
      version: null,
      filename,
      generatedBy: ctx.userName,
      summary,
    });

    if (format === 'xls') {
      // Plantilla Excel oficial CNMC (pestaña 'Datos' con celdas numéricas reales, verificada contra TM_R2-950_2026T3.xls)
      const aoa: Array<Array<string | number>> = [
        ['CANAL', 'ACTUACION_CAMPO', 'IND_ACTIVACION', 'NUM_ACTIVADAS', 'TIEMPO_MEDIO'],
        ...sortedRows.map(r => [
          r.canal,
          r.actuacionCampo,
          r.indActivacion,
          r.numActivadas,
          r.tiempoMedio,
        ]),
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, 'Datos');
      const xlsBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' });

      return new NextResponse(xlsBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.ms-excel',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Cabecera CSV exacta exigida por el validador CNMC (Apdo. 6.2 Manual SCC v6.0)
    let csv = 'CANAL;ACTUACION_CAMPO;IND_ACTIVACION;NUM_ACTIVADAS;TIEMPO_MEDIO\n';
    for (const r of sortedRows) {
      csv += `${r.canal};${r.actuacionCampo};${r.indActivacion};${r.numActivadas};${r.tiempoMedioStr}\n`;
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generando TM_CODAGE:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno generando TM_CODAGE' },
      { status: 500 }
    );
  }
}
