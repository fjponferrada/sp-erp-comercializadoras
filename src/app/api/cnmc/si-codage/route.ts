import { NextResponse } from 'next/server';
import { XMLBuilder } from 'fast-xml-parser';
import { prisma } from '@/lib/prisma';
import { parseMadridStartOfDay, toMadridYmd } from '@/lib/ppaEngine';
import {
  buildSwitchingCompanyWhere,
  classifyActivationTipoRetraso,
  classifyResponseTipoRetraso,
  createDistributorCnmcMapper,
  daysBetweenMadridDates,
  extractMotivoRechazoCnmc,
  isDateInMadridRange,
  logRegulatoryGeneration,
  mapTarifaAtrCnmc,
  mapTipoPuntoCnmc,
  requireRegulatoryContext,
  resolveIneProvinceCode,
} from '@/lib/regulacionServer';

type RetrasoCode = '00' | '05' | '15';
const RETRASO_ORDER: RetrasoCode[] = ['00', '05', '15'];

interface AvgCounter {
  sumDays: number;
  count: number;
}

interface ActivadasCounter {
  sumDays: number;
  count: number;
  incidencias: number;
}

interface PdteActivacionCounter {
  count: number;
  incidencias: number;
}

interface SiCodageGroup {
  Provincia: string;
  Distribuidor: string;
  Comer_entrante: string;
  Comer_saliente: string;
  TipoCambio: 'C3' | 'C4' | 'C6';
  TipoPunto: '1' | '2' | '3' | '4' | '5';
  TarifaATR: string;
  TotalSolicitudesEnviadas: number;
  SolicitudesAnuladas: number;
  Reposiciones: number;
  ClientesSalientes: number;
  NumImpagados: number;
  pendientesRespuesta: Record<RetrasoCode, number>;
  aceptadas: Record<RetrasoCode, AvgCounter>;
  rechazadas: Record<string, { retraso: RetrasoCode; motivo: string; sumDays: number; count: number }>;
  pdteActivacion: Record<RetrasoCode, PdteActivacionCounter>;
  activadas: Record<RetrasoCode, ActivadasCounter>;
}

function formatCnmcMeanTime(sumDays: number, count: number): string {
  if (count <= 0) return '0.0';
  const clamped = Math.min(999.99, Math.max(0, sumDays / count));
  const rounded2 = Math.round(clamped * 100) / 100;
  // Si el segundo decimal es 0, emitir 1 decimal (ej. "0.0", "1.4"); si no, hasta 2 decimales según Apdo. 10 Manual CNMC
  if (Math.round(rounded2 * 100) % 10 === 0) {
    return rounded2.toFixed(1);
  }
  return rounded2.toFixed(2);
}

function mapProcesoToTipoCambio(procesoBase: string): 'C3' | 'C4' | 'C6' {
  if (procesoBase === 'A3') return 'C4';
  if (procesoBase === 'E1') return 'C6';
  // C1, C2 y E2 (reposiciones) se declaran bajo C3 según Apdo. 4.2 y 11.7 Manual CNMC
  return 'C3';
}

function addMonthsToYm(year: number, month: number, deltaMonths: number): { y: number; m: number; ymd: string } {
  const total = year * 12 + (month - 1) + deltaMonths;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return {
    y,
    m,
    ymd: `${y}-${String(m).padStart(2, '0')}-01`,
  };
}

function getLastDayOfMonthYmd(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  try {
    const authRes = await requireRegulatoryContext();
    if (!authRes.ok) return authRes.response;
    const { ctx } = authRes;

    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes'); // YYYY-MM
    const rawVersion = (searchParams.get('version') || '01').trim();
    const version = /^\d{1,2}$/.test(rawVersion) && Number(rawVersion) > 0
      ? rawVersion.padStart(2, '0')
      : '01';
    const isPreview = searchParams.get('preview') === 'true';
    const allowEmpty = searchParams.get('allowEmpty') === 'true';

    if (!mes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      return NextResponse.json(
        { error: 'Falta o es inválido el parámetro mes (formato requerido: YYYY-MM).' },
        { status: 400 }
      );
    }

    const [yearStr, monthStr] = mes.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const startYmd = `${yearStr}-${monthStr}-01`;
    const nextMonth = addMonthsToYm(year, month, 1);
    const endYmd = nextMonth.ymd;
    const monthLastDayYmd = getLastDayOfMonthYmd(year, month);
    const lookback = addMonthsToYm(year, month, -14);

    const lookbackStartDate = parseMadridStartOfDay(lookback.ymd);
    const endExclusiveDate = parseMadridStartOfDay(endYmd);
    // Margen de 90 días previos para candidatos a "pendiente" cuando no hay contrato en estado explícito EN_TRAMITACION
    const pendingCutoffYmd = addMonthsToYm(year, month, -3).ymd;

    const [distributorsList, events] = await Promise.all([
      prisma.distributor.findMany({
        select: { reeCode: true, name: true, registroCnmc: true },
      }),
      prisma.switchingEvent.findMany({
        where: {
          AND: [
            // Excluimos explícitamente T1 (T1_01 lo emite la Distribuidora al saliente por traspaso a COR; Apdo. 10 y FAQ pág. 44)
            { procesoBase: { in: ['C1', 'C2', 'A3', 'E1', 'E2'] } },
            buildSwitchingCompanyWhere(ctx.companyId, ctx.isSingleCompanyDeployment),
            {
              OR: [
                { fechaSolicitud: { gte: lookbackStartDate, lt: endExclusiveDate } },
                { fechaAR: { gte: lookbackStartDate, lt: endExclusiveDate } },
                { fechaActivacionAlta: { gte: lookbackStartDate, lt: endExclusiveDate } },
                { fechaActivacionBaja: { gte: lookbackStartDate, lt: endExclusiveDate } },
                { fechaAviso: { gte: lookbackStartDate, lt: endExclusiveDate } },
              ],
            },
          ],
        },
        include: {
          supplyPoint: {
            select: {
              cups: true,
              postalCode: true,
              sipsPostalCode: true,
              province: true,
              distributorReeCode: true,
              distributor: true,
              distributorName: true,
              tariff: true,
              sipsTariff: true,
              p1c: true,
              p2c: true,
              p3c: true,
              p4c: true,
              p5c: true,
              p6c: true,
              sipsP1c: true,
              sipsP2c: true,
              sipsP3c: true,
              sipsP4c: true,
              sipsP5c: true,
              sipsP6c: true,
            },
          },
          contract: {
            select: {
              status: true,
              activationDate: true,
              terminationDate: true,
              supplyPoint: {
                select: {
                  cups: true,
                  postalCode: true,
                  sipsPostalCode: true,
                  province: true,
                  distributorReeCode: true,
                  distributor: true,
                  distributorName: true,
                  tariff: true,
                  sipsTariff: true,
                  p1c: true,
                  p2c: true,
                  p3c: true,
                  p4c: true,
                  p5c: true,
                  p6c: true,
                  sipsP1c: true,
                  sipsP2c: true,
                  sipsP3c: true,
                  sipsP4c: true,
                  sipsP5c: true,
                  sipsP6c: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const resolveDistributor = createDistributorCnmcMapper(distributorsList);

    // Agrupar todos los pasos por expediente (codigoSolicitud)
    const solicitudesMap = new Map<string, typeof events>();
    for (const ev of events) {
      if (!ev.codigoSolicitud) continue;
      const list = solicitudesMap.get(ev.codigoSolicitud);
      if (list) {
        list.push(ev);
      } else {
        solicitudesMap.set(ev.codigoSolicitud, [ev]);
      }
    }

    const groupedData: Record<string, SiCodageGroup> = {};
    const fallbackDistributorCups = new Set<string>();
    const fallbackProvinceCups = new Set<string>();

    const getOrCreateGroup = (sp: any, procesoBase: string): SiCodageGroup => {
      const prov = resolveIneProvinceCode(sp?.postalCode, sp?.sipsPostalCode, sp?.province);
      if (prov.isFallback && sp?.cups) fallbackProvinceCups.add(sp.cups);
      const provinciaCnmc = `${prov.code}000`;

      const dist = resolveDistributor(sp);
      if (dist.isFallback && sp?.cups) fallbackDistributorCups.add(sp.cups);

      const comerEntrante = ctx.codigoAgente;
      const comerSaliente = '0';
      const tipoCambio = mapProcesoToTipoCambio(procesoBase);
      const tipoPunto = mapTipoPuntoCnmc(sp);
      const tarifaAtr = mapTarifaAtrCnmc(sp?.tariff || sp?.sipsTariff);

      const key = `${provinciaCnmc}|${dist.code}|${comerEntrante}|${comerSaliente}|${tipoCambio}|${tipoPunto}|${tarifaAtr}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          Provincia: provinciaCnmc,
          Distribuidor: dist.code,
          Comer_entrante: comerEntrante,
          Comer_saliente: comerSaliente,
          TipoCambio: tipoCambio,
          TipoPunto: tipoPunto,
          TarifaATR: tarifaAtr,
          TotalSolicitudesEnviadas: 0,
          SolicitudesAnuladas: 0,
          Reposiciones: 0,
          ClientesSalientes: 0,
          NumImpagados: 0,
          pendientesRespuesta: { '00': 0, '05': 0, '15': 0 },
          aceptadas: {
            '00': { sumDays: 0, count: 0 },
            '05': { sumDays: 0, count: 0 },
            '15': { sumDays: 0, count: 0 },
          },
          rechazadas: {},
          pdteActivacion: {
            '00': { count: 0, incidencias: 0 },
            '05': { count: 0, incidencias: 0 },
            '15': { count: 0, incidencias: 0 },
          },
          activadas: {
            '00': { sumDays: 0, count: 0, incidencias: 0 },
            '05': { sumDays: 0, count: 0, incidencias: 0 },
            '15': { sumDays: 0, count: 0, incidencias: 0 },
          },
        };
      }
      return groupedData[key];
    };

    for (const [, rawPasos] of solicitudesMap.entries()) {
      // Ordenar cronológicamente y acotar estrictamente al corte fin de mes (< endYmd) para fidelidad histórica
      const pasosUpToEnd = rawPasos
        .filter(p => {
          const ts = p.fechaActivacionAlta || p.fechaActivacionBaja || p.fechaAR || p.fechaSolicitud || p.fechaAviso;
          const ymd = toMadridYmd(ts);
          return Boolean(ymd && ymd < endYmd);
        })
        .sort((a, b) => {
          const ta = (a.fechaSolicitud || a.fechaAR || a.fechaAviso).getTime();
          const tb = (b.fechaSolicitud || b.fechaAR || b.fechaAviso).getTime();
          return ta - tb;
        });

      if (pasosUpToEnd.length === 0) continue;

      // Solo procesamos expedientes iniciados por nuestra comercializadora (paso 01 existente antes del fin del mes)
      const pasoInicial = pasosUpToEnd.find(p => p.paso === '01');
      if (!pasoInicial) continue;

      const reqSentDate = pasoInicial.fechaSolicitud || pasoInicial.fechaAviso;
      const reqSentYmd = toMadridYmd(reqSentDate);
      if (!reqSentYmd || reqSentYmd >= endYmd) continue;

      const sp =
        pasoInicial.supplyPoint ||
        pasoInicial.contract?.supplyPoint ||
        pasosUpToEnd.find(p => p.supplyPoint)?.supplyPoint ||
        pasosUpToEnd.find(p => p.contract?.supplyPoint)?.contract?.supplyPoint;

      const contractInfo = pasoInicial.contract || pasosUpToEnd.find(p => p.contract)?.contract;

      // Caso especial E2: Reposiciones ejecutadas (Apdo. 4.2 y 11.7 Manual CNMC)
      if (pasoInicial.procesoBase === 'E2') {
        const pasoEjecutadoE2 = pasosUpToEnd.find(
          p => p.paso === '05' || p.paso === '06' || p.fechaActivacionAlta || p.fechaActivacionBaja
        );
        const fechaEjecE2 =
          pasoEjecutadoE2?.fechaActivacionAlta ||
          pasoEjecutadoE2?.fechaActivacionBaja ||
          pasoEjecutadoE2?.fechaAR ||
          pasoEjecutadoE2?.fechaSolicitud;

        if (pasoEjecutadoE2 && isDateInMadridRange(fechaEjecE2, startYmd, endYmd)) {
          const g = getOrCreateGroup(sp, 'E2');
          g.Reposiciones++;
        }
        continue;
      }

      // 1. Solicitudes enviadas en el mes
      const sentInMonth = isDateInMadridRange(reqSentDate, startYmd, endYmd);

      // 2. Solicitudes anuladas (paso 09 en C1/C2, paso 07 en A3, o marca isAnnulled)
      const annulConfirmationStep = pasosUpToEnd.find(p =>
        pasoInicial.procesoBase === 'A3'
          ? p.paso === '07' || (p.paso === '06' && p.estadoAR?.toUpperCase().includes('ACEPTAD'))
          : p.paso === '09' || (p.paso === '08' && p.estadoAR?.toUpperCase().includes('ACEPTAD'))
      );
      const anyAnnulStep =
        annulConfirmationStep ||
        pasosUpToEnd.find(p =>
          (pasoInicial.procesoBase === 'A3' ? p.paso === '06' : p.paso === '08') && p.isAnnulled
        );
      const isMarkedAnnulled = Boolean(anyAnnulStep || pasosUpToEnd.some(p => p.isAnnulled));
      const annulDate = isMarkedAnnulled
        ? anyAnnulStep?.fechaAR || anyAnnulStep?.fechaSolicitud || anyAnnulStep?.fechaAviso || reqSentDate
        : null;
      const annulledInMonth = Boolean(annulDate && isDateInMadridRange(annulDate, startYmd, endYmd));

      // 3. Aceptación en paso 02 (sin bug de precedencia booleana; Ejemplo 4 Manual CNMC)
      const pasoAceptado = pasosUpToEnd.find(
        p =>
          p.paso === '02' &&
          (Boolean(p.estadoAR?.toUpperCase().includes('ACEPTAD')) ||
            (!p.estadoAR?.toUpperCase().includes('RECHAZ') && !p.motivosRechazo))
      );
      const acceptDate = pasoAceptado
        ? pasoAceptado.fechaAR || pasoAceptado.fechaSolicitud || pasoAceptado.fechaAviso
        : null;
      const acceptedInMonth = Boolean(pasoAceptado && isDateInMadridRange(acceptDate, startYmd, endYmd));

      // 4. Rechazo en paso 02 y/o rechazo posterior en campo paso 04 (Ejemplo 4 Manual CNMC permite ambos en un mismo expediente)
      const pasoRechazo02 = pasosUpToEnd.find(
        p => p.paso === '02' && Boolean(p.estadoAR?.toUpperCase().includes('RECHAZ'))
      );
      const pasoRechazo04 = pasosUpToEnd.find(p => p.paso === '04');

      const rej02Date = pasoRechazo02
        ? pasoRechazo02.fechaAR || pasoRechazo02.fechaSolicitud || pasoRechazo02.fechaAviso
        : null;
      const rej04Date = pasoRechazo04
        ? pasoRechazo04.fechaAR || pasoRechazo04.fechaSolicitud || pasoRechazo04.fechaAviso
        : null;

      const rejected02InMonth = Boolean(pasoRechazo02 && isDateInMadridRange(rej02Date, startYmd, endYmd));
      const rejected04InMonth = Boolean(pasoRechazo04 && isDateInMadridRange(rej04Date, startYmd, endYmd));
      const hasAnyRejectionByEnd = Boolean(pasoRechazo02 || pasoRechazo04);

      // 5. Activación efectiva en paso 05 (Apdo. 11.5 Manual CNMC)
      const pasoActivado = !hasAnyRejectionByEnd && !isMarkedAnnulled
        ? pasosUpToEnd.find(p => p.paso === '05' || Boolean(p.fechaActivacionAlta))
        : undefined;
      const actDate = pasoActivado
        ? pasoActivado.fechaActivacionAlta || pasoActivado.fechaAR || pasoActivado.fechaSolicitud || pasoActivado.fechaAviso
        : null;
      const activatedInMonth = Boolean(pasoActivado && isDateInMadridRange(actDate, startYmd, endYmd));

      // Incidencias comunicadas en paso 03 antes o durante el mes
      const incidenciaSteps = pasosUpToEnd.filter(p => p.paso === '03');
      const hadIncidencia = incidenciaSteps.length > 0;

      // 6. Estado pendiente a cierre del mes (último día natural del mes)
      let pendingRespRetraso: RetrasoCode | null = null;
      let pendingActRetraso: RetrasoCode | null = null;

      if (!isMarkedAnnulled && !hasAnyRejectionByEnd && !pasoActivado) {
        const contractStatus = (contractInfo?.status || '').toUpperCase();
        const contractAlreadyClosed =
          ['CANCELADO', 'RECHAZADO', 'ANULADO', 'BAJA'].includes(contractStatus) ||
          (contractStatus === 'ACTIVO' &&
            contractInfo?.activationDate &&
            (toMadridYmd(contractInfo.activationDate) || '9999-12-31') < endYmd);

        const isRecentOrExplicitlyInFlight =
          reqSentYmd >= pendingCutoffYmd ||
          ['EN_TRAMITACION', 'PENDIENTE', 'ACEPTADO', 'ENVIADO', 'TRAMITACION'].includes(contractStatus);

        if (!contractAlreadyClosed && isRecentOrExplicitlyInFlight) {
          if (!pasoAceptado) {
            const daysWaitingResp = daysBetweenMadridDates(reqSentDate, monthLastDayYmd);
            pendingRespRetraso = classifyResponseTipoRetraso(daysWaitingResp);
          } else {
            const refPrevAct = pasoAceptado.fechaPrevActivacion || acceptDate || reqSentDate;
            const prevYmd = toMadridYmd(refPrevAct) || monthLastDayYmd;
            const overdueDays = prevYmd < monthLastDayYmd
              ? daysBetweenMadridDates(refPrevAct, monthLastDayYmd)
              : 0;
            pendingActRetraso = classifyActivationTipoRetraso(overdueDays);
          }
        }
      }

      const touchesMonth =
        sentInMonth ||
        annulledInMonth ||
        acceptedInMonth ||
        rejected02InMonth ||
        rejected04InMonth ||
        activatedInMonth ||
        pendingRespRetraso !== null ||
        pendingActRetraso !== null;

      if (!touchesMonth) continue;

      const g = getOrCreateGroup(sp, pasoInicial.procesoBase);

      if (sentInMonth) {
        g.TotalSolicitudesEnviadas++;
      }
      if (annulledInMonth) {
        g.SolicitudesAnuladas++;
      }
      if (acceptedInMonth && acceptDate) {
        const respDays = daysBetweenMadridDates(reqSentDate, acceptDate);
        const retraso = classifyResponseTipoRetraso(respDays);
        g.aceptadas[retraso].sumDays += respDays;
        g.aceptadas[retraso].count++;
      }
      if (rejected02InMonth && pasoRechazo02 && rej02Date) {
        const respDays = daysBetweenMadridDates(reqSentDate, rej02Date);
        const retraso = classifyResponseTipoRetraso(respDays);
        const motivo = extractMotivoRechazoCnmc(pasoRechazo02.motivosRechazo, pasoRechazo02.observaciones);
        const rKey = `${retraso}|${motivo}`;
        if (!g.rechazadas[rKey]) {
          g.rechazadas[rKey] = { retraso, motivo, sumDays: 0, count: 0 };
        }
        g.rechazadas[rKey].sumDays += respDays;
        g.rechazadas[rKey].count++;
      }
      if (rejected04InMonth && pasoRechazo04 && rej04Date) {
        const totalRejDays = daysBetweenMadridDates(reqSentDate, rej04Date);
        const retraso = pasoAceptado?.fechaPrevActivacion
          ? classifyActivationTipoRetraso(daysBetweenMadridDates(pasoAceptado.fechaPrevActivacion, rej04Date))
          : classifyResponseTipoRetraso(totalRejDays);
        const motivo = extractMotivoRechazoCnmc(pasoRechazo04.motivosRechazo, pasoRechazo04.observaciones);
        const rKey = `${retraso}|${motivo}`;
        if (!g.rechazadas[rKey]) {
          g.rechazadas[rKey] = { retraso, motivo, sumDays: 0, count: 0 };
        }
        g.rechazadas[rKey].sumDays += totalRejDays;
        g.rechazadas[rKey].count++;
      }
      if (activatedInMonth && actDate) {
        // Fórmula oficial Apdo. 11.5 Manual CNMC:
        // TMActivacion = max(0, FechaActivacionEfectiva - FechaActivacionPrevista)
        // Si hubo incidencia ajena (paso 03), referencia desde comunicación de la 1ª incidencia si es posterior.
        let refExpectedDate = pasoAceptado?.fechaPrevActivacion || acceptDate || reqSentDate;
        if (hadIncidencia) {
          const firstInc = incidenciaSteps[0];
          const incDate = firstInc.fechaSolicitud || firstInc.fechaAR || firstInc.fechaAviso;
          if (incDate && (!pasoAceptado?.fechaPrevActivacion || incDate > pasoAceptado.fechaPrevActivacion)) {
            refExpectedDate = incDate;
          }
        }
        const operationalDelayDays = daysBetweenMadridDates(refExpectedDate, actDate);
        const retraso = classifyActivationTipoRetraso(operationalDelayDays);
        g.activadas[retraso].sumDays += operationalDelayDays;
        g.activadas[retraso].count++;
        if (hadIncidencia) {
          g.activadas[retraso].incidencias++;
        }
      }
      if (pendingRespRetraso) {
        g.pendientesRespuesta[pendingRespRetraso]++;
      }
      if (pendingActRetraso) {
        g.pdteActivacion[pendingActRetraso].count++;
        if (hadIncidencia) {
          g.pdteActivacion[pendingActRetraso].incidencias++;
        }
      }
    }

    // Construir nodos <DatosSolicitudes> respetando estrictamente xs:sequence de SolicitudesRealizadas_v1.0.xsd
    let kpiEnviadas = 0;
    let kpiAceptadas = 0;
    let kpiRechazadas = 0;
    let kpiActivadas = 0;
    let kpiAnuladas = 0;
    let kpiReposiciones = 0;
    let kpiPendientes = 0;

    const sortedGroups = Object.values(groupedData).sort((a, b) =>
      `${a.Provincia}|${a.Distribuidor}|${a.TipoCambio}|${a.TipoPunto}|${a.TarifaATR}`.localeCompare(
        `${b.Provincia}|${b.Distribuidor}|${b.TipoCambio}|${b.TipoPunto}|${b.TarifaATR}`
      )
    );

    const datosSolicitudes: any[] = [];
    const previewRows: any[] = [];

    for (const g of sortedGroups) {
      const detallePendResp = RETRASO_ORDER
        .filter(r => g.pendientesRespuesta[r] > 0)
        .map(r => ({
          TipoRetraso: r,
          NumSolicitudesPendientes: g.pendientesRespuesta[r],
        }));

      const detalleAceptadas = RETRASO_ORDER
        .filter(r => g.aceptadas[r].count > 0)
        .map(r => ({
          TipoRetraso: r,
          TMSolicitudesAceptadas: formatCnmcMeanTime(g.aceptadas[r].sumDays, g.aceptadas[r].count),
          NumSolicitudesAceptadas: g.aceptadas[r].count,
        }));

      const detalleRechazadas = Object.values(g.rechazadas)
        .filter(r => r.count > 0)
        .sort((a, b) => `${a.retraso}|${a.motivo}`.localeCompare(`${b.retraso}|${b.motivo}`))
        .map(r => ({
          TipoRetraso: r.retraso,
          TMSolicitudesRechazadas: formatCnmcMeanTime(r.sumDays, r.count),
          MotivoRechazo: r.motivo.slice(0, 2),
          NumSolicitudesRechazadas: r.count,
        }));

      const detallePdteAct = RETRASO_ORDER
        .filter(r => g.pdteActivacion[r].count > 0)
        .map(r => ({
          TipoRetraso: r,
          NumIncidencias: g.pdteActivacion[r].incidencias,
          NumSolicitudesPdteActivacion: g.pdteActivacion[r].count,
        }));

      const detalleActivadas = RETRASO_ORDER
        .filter(r => g.activadas[r].count > 0)
        .map(r => ({
          TipoRetraso: r,
          TMActivacion: formatCnmcMeanTime(g.activadas[r].sumDays, g.activadas[r].count),
          NumIncidencias: g.activadas[r].incidencias,
          NumSolicitudesActivadas: g.activadas[r].count,
        }));

      const hasActivity =
        g.TotalSolicitudesEnviadas > 0 ||
        g.SolicitudesAnuladas > 0 ||
        g.Reposiciones > 0 ||
        detallePendResp.length > 0 ||
        detalleAceptadas.length > 0 ||
        detalleRechazadas.length > 0 ||
        detallePdteAct.length > 0 ||
        detalleActivadas.length > 0;

      if (!hasActivity) continue;

      const node: Record<string, any> = {
        Provincia: g.Provincia,
        Distribuidor: g.Distribuidor,
        Comer_entrante: g.Comer_entrante,
        Comer_saliente: g.Comer_saliente,
        TipoCambio: g.TipoCambio,
        TipoPunto: g.TipoPunto,
        TarifaATR: g.TarifaATR,
        TotalSolicitudesEnviadas: g.TotalSolicitudesEnviadas,
        SolicitudesAnuladas: g.SolicitudesAnuladas,
        Reposiciones: g.Reposiciones,
        ClientesSalientes: g.ClientesSalientes,
        NumImpagados: g.NumImpagados,
      };

      // Orden estricto XSD SolicitudesRealizadas_v1.0.xsd:
      // 1º DetallePendientesRespuesta -> 2º DetalleAceptadas -> 3º DetalleRechazadas -> 4º DetallePdteActivacion -> 5º DetalleActivadas
      if (detallePendResp.length > 0) node.DetallePendientesRespuesta = detallePendResp;
      if (detalleAceptadas.length > 0) node.DetalleAceptadas = detalleAceptadas;
      if (detalleRechazadas.length > 0) node.DetalleRechazadas = detalleRechazadas;
      if (detallePdteAct.length > 0) node.DetallePdteActivacion = detallePdteAct;
      if (detalleActivadas.length > 0) node.DetalleActivadas = detalleActivadas;

      datosSolicitudes.push(node);

      const groupAceptadas = detalleAceptadas.reduce((acc, x) => acc + x.NumSolicitudesAceptadas, 0);
      const groupRechazadas = detalleRechazadas.reduce((acc, x) => acc + x.NumSolicitudesRechazadas, 0);
      const groupActivadas = detalleActivadas.reduce((acc, x) => acc + x.NumSolicitudesActivadas, 0);
      const groupPendResp = detallePendResp.reduce((acc, x) => acc + x.NumSolicitudesPendientes, 0);
      const groupPdteAct = detallePdteAct.reduce((acc, x) => acc + x.NumSolicitudesPdteActivacion, 0);

      kpiEnviadas += g.TotalSolicitudesEnviadas;
      kpiAnuladas += g.SolicitudesAnuladas;
      kpiReposiciones += g.Reposiciones;
      kpiAceptadas += groupAceptadas;
      kpiRechazadas += groupRechazadas;
      kpiActivadas += groupActivadas;
      kpiPendientes += groupPendResp + groupPdteAct;

      previewRows.push({
        provincia: g.Provincia,
        distribuidor: g.Distribuidor,
        tipoCambio: g.TipoCambio,
        tipoPunto: g.TipoPunto,
        tarifaAtr: g.TarifaATR,
        enviadas: g.TotalSolicitudesEnviadas,
        anuladas: g.SolicitudesAnuladas,
        reposiciones: g.Reposiciones,
        aceptadas: groupAceptadas,
        rechazadas: groupRechazadas,
        activadas: groupActivadas,
        pendientesRespuesta: groupPendResp,
        pendientesActivacion: groupPdteAct,
        motivosRechazo: detalleRechazadas.map(r => `${r.MotivoRechazo} (${r.NumSolicitudesRechazadas})`).join(', '),
      });
    }

    const emptyMonth = datosSolicitudes.length === 0;
    const warnings: string[] = [];

    if (emptyMonth) {
      warnings.push(
        `Sin actividad ni solicitudes pendientes en ${mes}. Según el Apdo. 3.3 y FAQ (pág. 43) del Manual CNMC SCC v6.0, cuando no se ha gestionado ninguna solicitud en el periodo no debe subirse un XML con <SolicitudesRealizadas /> vacío, sino comunicar la ausencia de actividad por correo a cambiodecomercializador@cnmc.es indicando el código ${ctx.codigoAgente} y el periodo ${yearStr}${monthStr}.`
      );
    }
    if (fallbackDistributorCups.size > 0) {
      warnings.push(
        `${fallbackDistributorCups.size} suministro(s) carecen de código distribuidora R1/REE identificable y se han asignado por defecto a R1-299.`
      );
    }
    if (fallbackProvinceCups.size > 0) {
      warnings.push(
        `${fallbackProvinceCups.size} suministro(s) carecen de código postal válido de 5 dígitos; revise su provincia antes de presentar.`
      );
    }

    const filename = `SI_${ctx.codigoAgente}_E_${yearStr}${monthStr}_${version}.xml`;
    const summary = {
      periodo: `${yearStr}${monthStr}`,
      version,
      grupos: datosSolicitudes.length,
      enviadas: kpiEnviadas,
      aceptadas: kpiAceptadas,
      rechazadas: kpiRechazadas,
      activadas: kpiActivadas,
      anuladas: kpiAnuladas,
      reposiciones: kpiReposiciones,
      pendientes: kpiPendientes,
      emptyMonth,
    };

    if (isPreview) {
      return NextResponse.json({
        company: {
          name: ctx.company.name,
          cif: ctx.company.cif,
          codigoAgente: ctx.codigoAgente,
        },
        mes,
        version,
        filename,
        emptyMonth,
        summary,
        warnings,
        rows: previewRows,
      });
    }

    if (emptyMonth && !allowEmpty) {
      return NextResponse.json(
        {
          error: `No existen solicitudes ni expedientes pendientes en ${mes} para ${ctx.company.name} (${ctx.codigoAgente}). Según el Apdo. 3.3 del Manual CNMC SCC v6.0, no debe entregarse un XML vacío en sede electrónica, sino notificar "Sin actividad" por email a cambiodecomercializador@cnmc.es.`,
          emptyMonth: true,
          cnmcEmail: 'cambiodecomercializador@cnmc.es',
        },
        { status: 422 }
      );
    }

    // En SolicitudesRealizadas_v1.0.xsd, <SolicitudesRealizadas> es minOccurs="0", pero si se incluye requiere al menos 1 <DatosSolicitudes>.
    const mensajeBody: Record<string, any> = {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@_xsi:noNamespaceSchemaLocation': 'SolicitudesRealizadas_v1.0.xsd',
      Cabecera: {
        CodigoAgente: ctx.codigoAgente,
        TipoMercado: 'E',
        TipoAgente: 'C',
        Periodo: `${yearStr}${monthStr}`,
      },
    };

    if (datosSolicitudes.length > 0) {
      mensajeBody.SolicitudesRealizadas = {
        DatosSolicitudes: datosSolicitudes,
      };
    }

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
    });

    let xmlData = builder.build({
      MensajeSolicitudesRealizadas: mensajeBody,
    });
    if (!xmlData.trimStart().startsWith('<?xml')) {
      xmlData = `<?xml version="1.0" encoding="UTF-8"?>\n${xmlData}`;
    }

    await logRegulatoryGeneration({
      companyId: ctx.companyId,
      category: 'CNMC',
      reportType: 'SI_CODAGE',
      period: mes,
      version,
      filename,
      generatedBy: ctx.userName,
      summary,
    });

    return new NextResponse(xmlData, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating SI_CODAGE XML:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor al generar SI_CODAGE' },
      { status: 500 }
    );
  }
}
