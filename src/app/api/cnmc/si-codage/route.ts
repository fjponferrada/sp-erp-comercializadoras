import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { XMLBuilder } from 'fast-xml-parser';
import { auth } from '@/auth';
import { resolveActiveCompanyId } from '@/lib/companyContext';

function extractMotivoRechazoCode(pasoRechazado: any): string {
  const pickCode = (raw: any): string | null => {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const cleaned = raw.trim().toUpperCase();
      return /^[A-Z0-9]{1,2}$/.test(cleaned) ? cleaned.padStart(2, '0') : null;
    }
    if (Array.isArray(raw)) {
      for (const item of raw) {
        const found = pickCode(item);
        if (found) return found;
      }
      return null;
    }
    if (typeof raw === 'object') {
      const direct =
        raw.codigo ||
        raw.CodigoMotivo ||
        raw.CodigoMotivoRechazo ||
        raw.Motivo ||
        raw.MotivoRechazo ||
        raw.Rechazo;
      return pickCode(direct);
    }
    return null;
  };

  if (pasoRechazado?.motivosRechazo) {
    try {
      const parsed =
        typeof pasoRechazado.motivosRechazo === 'string'
          ? JSON.parse(pasoRechazado.motivosRechazo)
          : pasoRechazado.motivosRechazo;
      const code = pickCode(parsed);
      if (code) return code;
    } catch {
      // Ignore parse error and fallback below
    }
  }

  if (pasoRechazado?.observaciones && typeof pasoRechazado.observaciones === 'string') {
    // Check formatted "[29 - ...]" pattern first
    const bracketMatch = pasoRechazado.observaciones.match(/\[([A-Z0-9]{1,2})\s*-/i);
    if (bracketMatch?.[1]) {
      return bracketMatch[1].toUpperCase().padStart(2, '0');
    }
    try {
      const obsObj = JSON.parse(pasoRechazado.observaciones);
      const code = pickCode(obsObj?.Motivo || obsObj?.MotivosRechazo?.Motivo || obsObj);
      if (code) return code;
    } catch {
      // Non-JSON text
    }
  }

  return '99';
}

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
    const rawVersion = (searchParams.get('version') || '01').trim();
    const version = /^\d{1,2}$/.test(rawVersion) ? rawVersion.padStart(2, '0') : '01';

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: 'Falta o es inválido el parámetro mes (YYYY-MM)' }, { status: 400 });
    }

    const [yearStr, monthStr] = mes.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const activeCompanyId = await resolveActiveCompanyId(session);
    const company = activeCompanyId
      ? await prisma.company.findUnique({ where: { id: activeCompanyId } })
      : await prisma.company.findFirst();

    if (!company) {
      return NextResponse.json({ error: 'No se encontró información de la empresa comercializadora' }, { status: 500 });
    }

    const codigoAgente = company.ordenCnmc || 'R2-950';

    // Fetch all Distributors for R1-xxx mapping
    const distributorsList = await prisma.distributor.findMany();

    const companyScopeOr: any[] = [
      { contract: { brand: { companyId: company.id } } },
      { supplyPoint: { client: { brand: { companyId: company.id } } } },
    ];
    if (company.codigoRee) {
      companyScopeOr.push({ uniqueProcess: { startsWith: `${company.codigoRee}_` } });
    }

    // Fetch Switching Events for the month scoped to active company
    const events = await prisma.switchingEvent.findMany({
      where: {
        fechaSolicitud: {
          gte: startDate,
          lt: endDate,
        },
        procesoBase: {
          in: ['C1', 'C2', 'A3', 'T1', 'E1', 'E2'],
        },
        OR: companyScopeOr,
      },
      include: {
        supplyPoint: {
          select: {
            postalCode: true,
            distributorReeCode: true,
            distributor: true,
            tariff: true,
          },
        },
      },
    });

    // Grouping structure for the output XML
    // Key: Provincia|Distribuidor|Comer_entrante|Comer_saliente|TipoCambio|TipoPunto|TarifaATR
    const groupedData: Record<string, any> = {};

    const mapDistribuidor = (sp: any) => {
      const ree = sp?.distributorReeCode?.trim();
      if (ree) {
        const byRee = distributorsList.find(dist => dist.reeCode === ree);
        if (byRee?.registroCnmc) return byRee.registroCnmc;
        if (ree === '0021') return 'R1-001';
        if (ree === '0031' || ree === '0288' || ree === '0029') return 'R1-002';
        if (ree === '0022' || ree === '0390') return 'R1-299';
        if (ree === '0026') return 'R1-053';
        if (ree === '0027') return 'R1-008';
      }

      const d = sp?.distributor?.toUpperCase() || '';
      if (d) {
        const matchedDistributor = distributorsList.find(
          dist => d.includes(dist.name.toUpperCase()) || dist.name.toUpperCase().includes(d)
        );
        if (matchedDistributor?.registroCnmc) {
          return matchedDistributor.registroCnmc;
        }
        if (matchedDistributor?.reeCode) {
          return matchedDistributor.reeCode;
        }

        if (d.includes('IBERDROLA') || d.includes('I-DE')) return 'R1-001';
        if (d.includes('EDISTRIBUCION') || d.includes('ENDESA')) return 'R1-002';
        if (d.includes('UFD') || d.includes('UNION FENOSA')) return 'R1-299';
        if (d.includes('E-REDES') || d.includes('CANTABRICO')) return 'R1-053';
        if (d.includes('VIESGO')) return 'R1-008';
      }

      if (ree) return ree;
      return 'R1-299';
    };

    const mapTariff = (tariff: string) => {
      if (!tariff) return 'E1';
      if (tariff.includes('2.0')) return 'E1';
      if (tariff.includes('3.0')) return 'E2';
      if (tariff.includes('6.1')) return 'E3';
      if (tariff.includes('6.2')) return 'E4';
      if (tariff.includes('6.3')) return 'E5';
      if (tariff.includes('6.4')) return 'E6';
      return 'E1';
    };

    const mapProceso = (procesoBase: string) => {
      if (procesoBase === 'C1' || procesoBase === 'C2' || procesoBase === 'E2') return 'C3';
      if (procesoBase === 'A3') return 'C4';
      if (procesoBase === 'T1') return 'C5';
      if (procesoBase === 'E1') return 'C6';
      return 'C3';
    };

    // Group events by `codigoSolicitud` since one request can have multiple steps (pasos)
    const solicitudes: Record<string, any[]> = {};
    for (const ev of events) {
      if (ev.codigoSolicitud) {
        if (!solicitudes[ev.codigoSolicitud]) solicitudes[ev.codigoSolicitud] = [];
        solicitudes[ev.codigoSolicitud].push(ev);
      }
    }

    // Process each 'solicitud' as a single entity
    for (const [, pasos] of Object.entries(solicitudes)) {
      // Si no hay paso 01, significa que el trámite no lo iniciamos nosotros
      const pasoInicial = pasos.find(p => p.paso === '01');
      if (!pasoInicial) continue;

      const sp = pasoInicial.supplyPoint;
      const provincia = sp?.postalCode ? sp.postalCode.substring(0, 2) + '000' : '28000';
      const distribuidor = mapDistribuidor(sp);
      const comerEntrante = codigoAgente;
      const comerSaliente = '0';
      const tipoCambio = mapProceso(pasoInicial.procesoBase);
      const tipoPunto = '5';
      const tarifaAtr = mapTariff(sp?.tariff);

      const key = `${provincia}|${distribuidor}|${comerEntrante}|${comerSaliente}|${tipoCambio}|${tipoPunto}|${tarifaAtr}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          Provincia: provincia,
          Distribuidor: distribuidor,
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
          aceptadas: { sum: 0, count: 0 },
          rechazadas: {},
          activadas: { sum: 0, count: 0, incidencias: 0 },
        };
      }

      const g = groupedData[key];

      if (pasoInicial.procesoBase === 'E2') {
        g.Reposiciones++;
      } else {
        g.TotalSolicitudesEnviadas++;
      }

      if (pasoInicial.procesoBase !== 'E2') {
        const isAnulada = pasos.some(p => p.isAnnulled);
        if (isAnulada) {
          g.SolicitudesAnuladas++;
        }

        // Only Paso 02 is an acceptance in C1/C2/A3/T1/E1 (Paso 04 in C1/C2/A3/M1 is always MensajeRechazo)
        const pasoAceptado = pasos.find(
          p =>
            p.paso === '02' &&
            (p.estadoAR?.includes('ACEPTAD') || (!p.estadoAR?.includes('RECHAZ') && !p.tipoError))
        );
        if (pasoAceptado && pasoAceptado.fechaAR && pasoInicial.fechaSolicitud) {
          const diffDays = Math.max(
            0,
            (pasoAceptado.fechaAR.getTime() - pasoInicial.fechaSolicitud.getTime()) / (1000 * 3600 * 24)
          );
          g.aceptadas.sum += diffDays;
          g.aceptadas.count++;
        }

        const pasoRechazado = pasos.find(
          p => (p.paso === '02' && p.estadoAR?.includes('RECHAZ')) || p.paso === '04'
        );
        if (pasoRechazado && pasoInicial.fechaSolicitud) {
          const diffDays = pasoRechazado.fechaAR
            ? Math.max(
                0,
                (pasoRechazado.fechaAR.getTime() - pasoInicial.fechaSolicitud.getTime()) / (1000 * 3600 * 24)
              )
            : 0;

          const motivo = extractMotivoRechazoCode(pasoRechazado);
          if (!g.rechazadas[motivo]) g.rechazadas[motivo] = { sum: 0, count: 0 };
          g.rechazadas[motivo].sum += diffDays;
          g.rechazadas[motivo].count++;
        }

        const pasoActivado = pasos.find(p => p.paso === '05' || p.fechaActivacionAlta);
        if (pasoActivado && (pasoActivado.fechaActivacionAlta || pasoActivado.fechaAviso) && pasoInicial.fechaSolicitud) {
          const fechaAct = pasoActivado.fechaActivacionAlta || pasoActivado.fechaAviso;
          const diffDays = Math.max(
            0,
            (fechaAct.getTime() - pasoInicial.fechaSolicitud.getTime()) / (1000 * 3600 * 24)
          );
          g.activadas.sum += diffDays;
          g.activadas.count++;
          if (pasos.some(p => p.paso === '03')) {
            g.activadas.incidencias++;
          }
        }
      }
    }

    // Prepare XML Object
    const datosSolicitudes = Object.values(groupedData).map(g => {
      const node: any = {
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

      if (g.aceptadas.count > 0) {
        node.DetalleAceptadas = {
          TipoRetraso: '00',
          TMSolicitudesAceptadas: (g.aceptadas.sum / g.aceptadas.count).toFixed(1),
          NumSolicitudesAceptadas: g.aceptadas.count,
        };
      }

      const rechazosList = [];
      for (const [motivo, data] of Object.entries(g.rechazadas) as any) {
        rechazosList.push({
          TipoRetraso: '00',
          TMSolicitudesRechazadas: (data.sum / data.count).toFixed(1),
          MotivoRechazo: motivo.substring(0, 2),
          NumSolicitudesRechazadas: data.count,
        });
      }

      if (rechazosList.length > 0) {
        node.DetalleRechazadas = rechazosList;
      }

      if (g.activadas.count > 0) {
        node.DetalleActivadas = {
          TipoRetraso: '00',
          TMActivacion: (g.activadas.sum / g.activadas.count).toFixed(1),
          NumIncidencias: g.activadas.incidencias,
          NumSolicitudesActivadas: g.activadas.count,
        };
      }

      return node;
    });

    const xmlObj = {
      '?xml': {
        '@_version': '1.0',
        '@_encoding': 'UTF-8',
      },
      MensajeSolicitudesRealizadas: {
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@_xsi:noNamespaceSchemaLocation': 'SolicitudesRealizadas_v1.0.xsd',
        Cabecera: {
          CodigoAgente: codigoAgente,
          TipoMercado: 'E',
          TipoAgente: 'C',
          Periodo: `${yearStr}${monthStr}`,
        },
        SolicitudesRealizadas: {
          DatosSolicitudes: datosSolicitudes,
        },
      },
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
    });

    let xmlData = builder.build(xmlObj);
    if (!xmlData.includes('<?xml')) {
      xmlData = `<?xml version="1.0" encoding="UTF-8"?>\n` + xmlData;
    }

    const filename = `SI_${codigoAgente}_E_${yearStr}${monthStr}_${version}.xml`;

    return new NextResponse(xmlData, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating SI CODAGE XML:', error);
    return NextResponse.json({ error: 'Error interno del servidor al generar el XML' }, { status: 500 });
  }
}
