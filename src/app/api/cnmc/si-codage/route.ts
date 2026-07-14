import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { XMLBuilder } from 'fast-xml-parser';

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

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Get Brand/Company details (Assuming the user operates from their primary brand)
    const brand = await prisma.brand.findFirst({
      include: { company: true }
    });

    if (!brand || !brand.company) {
      return NextResponse.json({ error: 'No se encontró información de la empresa comercializadora' }, { status: 500 });
    }

    const codigoAgente = brand.company.ordenCnmc || 'R2-950'; // Defaulting to AED's if missing

    // Fetch all Distributors for fallback mapping
    const distributorsList = await prisma.distributor.findMany();

    // Fetch Switching Events for the month
    const events = await prisma.switchingEvent.findMany({
      where: {
        fechaSolicitud: {
          gte: startDate,
          lt: endDate,
        },
        procesoBase: {
          in: ['C1', 'C2', 'A3', 'T1', 'E1', 'E2'] 
        }
      },
      include: {
        supplyPoint: {
          select: {
            postalCode: true,
            distributorReeCode: true,
            distributor: true,
            tariff: true,
          }
        }
      }
    });

    // Grouping structure for the output XML
    // Key: Provincia|Distribuidor|Comer_entrante|Comer_saliente|TipoCambio|TipoPunto|TarifaATR
    const groupedData: Record<string, any> = {};

    const mapDistribuidor = (sp: any) => {
      if (sp?.distributorReeCode) return sp.distributorReeCode;
      
      const d = sp?.distributor?.toUpperCase() || '';
      
      // Intentar buscar en la tabla de distribuidores por nombre aproximado
      const matchedDistributor = distributorsList.find(dist => d.includes(dist.name.toUpperCase()) || dist.name.toUpperCase().includes(d));
      if (matchedDistributor && matchedDistributor.registroCnmc) {
        return matchedDistributor.registroCnmc;
      } else if (matchedDistributor && matchedDistributor.reeCode) {
        return matchedDistributor.reeCode;
      }

      // Hardcoded fallback if DB match fails
      if (d.includes('IBERDROLA')) return 'R1-001';
      if (d.includes('EDISTRIBUCION') || d.includes('ENDESA')) return 'R1-002';
      if (d.includes('UFD') || d.includes('UNION FENOSA')) return 'R1-299';
      if (d.includes('E-REDES') || d.includes('CANTABRICO')) return 'R1-053';
      if (d.includes('VIESGO')) return 'R1-008';
      return 'R1-299'; // Default to UFD if unknown
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
      // C1/C2/E2 (Switching/Reposición) -> C3
      if (procesoBase === 'C1' || procesoBase === 'C2' || procesoBase === 'E2') return 'C3';
      // A3 (Altas) -> C4
      if (procesoBase === 'A3') return 'C4';
      // T1 (Traspasos) -> C5
      if (procesoBase === 'T1') return 'C5';
      // E1 (Desistimientos) -> C6
      if (procesoBase === 'E1') return 'C6';
      
      return 'C3'; // fallback
    };

    // First group events by `codigoSolicitud` since one request can have multiple steps (pasos)
    const solicitudes: Record<string, any[]> = {};
    for (const ev of events) {
      if (ev.codigoSolicitud) {
        if (!solicitudes[ev.codigoSolicitud]) solicitudes[ev.codigoSolicitud] = [];
        solicitudes[ev.codigoSolicitud].push(ev);
      }
    }

    // Process each 'solicitud' as a single entity
    for (const [codSol, pasos] of Object.entries(solicitudes)) {
      // Find the initial step to determine metadata
      // Si no hay paso 01, significa que el trámite no lo iniciamos nosotros 
      // (ej. es una notificación de baja C1_05). No debemos reportarlo.
      const pasoInicial = pasos.find(p => p.paso === '01');
      if (!pasoInicial) continue;

      const sp = pasoInicial.supplyPoint;
      
      const provincia = sp?.postalCode ? sp.postalCode.substring(0, 2) + '000' : '28000';
      const distribuidor = mapDistribuidor(sp);
      const comerEntrante = codigoAgente;
      const comerSaliente = pasoInicial.procesoBase === 'A3' ? '0' : '0'; // A3 is definitely 0, for C3 it could be populated if known, but 0 is safe
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
          activadas: { sum: 0, count: 0 }
        };
      }

      const g = groupedData[key];
      
      if (pasoInicial.procesoBase === 'E2') {
        g.Reposiciones++;
      } else {
        g.TotalSolicitudesEnviadas++;
      }

      // Evaluate states based on steps (only for non-E2 processes, or E2 if you track them)
      if (pasoInicial.procesoBase !== 'E2') {
        const isAnulada = pasos.some(p => p.isAnnulled);
      if (isAnulada) {
        g.SolicitudesAnuladas++;
      }

      const pasoAceptado = pasos.find(p => (p.paso === '02' || p.paso === '04') && p.estadoAR === 'ACEPTADO' || ((p.paso === '02' || p.paso === '04') && !p.tipoError));
      if (pasoAceptado && pasoAceptado.fechaAR && pasoInicial.fechaSolicitud) {
        const diffDays = Math.max(0, (pasoAceptado.fechaAR.getTime() - pasoInicial.fechaSolicitud.getTime()) / (1000 * 3600 * 24));
        g.aceptadas.sum += diffDays;
        g.aceptadas.count++;
      }

      const pasoRechazado = pasos.find(p => (p.paso === '02' || p.paso === '04') && p.estadoAR === 'RECHAZADO' || p.tipoError);
      if (pasoRechazado && pasoInicial.fechaSolicitud) {
        const diffDays = pasoRechazado.fechaAR ? Math.max(0, (pasoRechazado.fechaAR.getTime() - pasoInicial.fechaSolicitud.getTime()) / (1000 * 3600 * 24)) : 0;
        
        let motivo = '99'; // default reason code
        
        if (pasoRechazado.motivosRechazo) {
          try {
            const mObj: any = pasoRechazado.motivosRechazo;
            const m = mObj?.Motivo || mObj;
            if (m) {
              if (Array.isArray(m) && m.length > 0 && m[0].CodigoMotivo) {
                motivo = m[0].CodigoMotivo;
              } else if (m.CodigoMotivo) {
                motivo = m.CodigoMotivo;
              }
            }
          } catch(e) {}
        } else if (pasoRechazado.observaciones) {
          try {
            const obsObj = JSON.parse(pasoRechazado.observaciones);
            const m = obsObj?.Motivo || obsObj?.MotivosRechazo?.Motivo || obsObj;
            if (m) {
              if (Array.isArray(m) && m.length > 0 && m[0].CodigoMotivo) {
                motivo = m[0].CodigoMotivo;
              } else if (m.CodigoMotivo) {
                motivo = m.CodigoMotivo;
              }
            }
          } catch(e) {} // Si no es JSON, ignora
        }
        
        // Si no se encontró el código oficial pero hay tipoError interno, intentamos mapearlo o acortarlo
        if (motivo === '99' && pasoRechazado.tipoError) {
           motivo = pasoRechazado.tipoError.substring(0, 2);
        }

        // Must be short CNMC code, e.g. "01", "B7"
        motivo = String(motivo).substring(0, 2);

        if (!g.rechazadas[motivo]) g.rechazadas[motivo] = { sum: 0, count: 0 };
        g.rechazadas[motivo].sum += diffDays;
        g.rechazadas[motivo].count++;
      }

      const pasoActivado = pasos.find(p => p.paso === '05' || p.fechaActivacionAlta);
      if (pasoActivado && (pasoActivado.fechaActivacionAlta || pasoActivado.fechaAviso) && pasoInicial.fechaSolicitud) {
        const fechaAct = pasoActivado.fechaActivacionAlta || pasoActivado.fechaAviso;
        const diffDays = Math.max(0, (fechaAct.getTime() - pasoInicial.fechaSolicitud.getTime()) / (1000 * 3600 * 24));
        g.activadas.sum += diffDays;
        g.activadas.count++;
      }
      } // End of if (pasoInicial.procesoBase !== 'E2')
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
          NumSolicitudesAceptadas: g.aceptadas.count
        };
      }

      const rechazosList = [];
      for (const [motivo, data] of Object.entries(g.rechazadas) as any) {
        rechazosList.push({
          TipoRetraso: '00',
          TMSolicitudesRechazadas: (data.sum / data.count).toFixed(1),
          MotivoRechazo: motivo.substring(0, 2), // Must be short CNMC code, e.g. "01", "B7"
          NumSolicitudesRechazadas: data.count
        });
      }
      
      // fast-xml-parser can render arrays if we just give it an array of objects
      if (rechazosList.length > 0) {
        // According to standard, it's multiple <DetalleRechazadas> nodes
        node.DetalleRechazadas = rechazosList;
      }

      if (g.activadas.count > 0) {
        node.DetalleActivadas = {
          TipoRetraso: '00',
          TMActivacion: (g.activadas.sum / g.activadas.count).toFixed(1),
          NumIncidencias: 0,
          NumSolicitudesActivadas: g.activadas.count
        };
      }

      return node;
    });

    // Handle empty data
    if (datosSolicitudes.length === 0) {
       // Return a dummy/empty structure if no data? No, let's just make it empty but valid
    }

    const xmlObj = {
      '?xml': {
        '@_version': '1.0',
        '@_encoding': 'UTF-8'
      },
      MensajeSolicitudesRealizadas: {
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@_xsi:noNamespaceSchemaLocation': 'SolicitudesRealizadas_v1.0.xsd',
        Cabecera: {
          CodigoAgente: codigoAgente,
          TipoMercado: 'E',
          TipoAgente: 'C',
          Periodo: `${yearStr}${monthStr}`
        },
        SolicitudesRealizadas: {
          DatosSolicitudes: datosSolicitudes
        }
      }
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true
    });
    
    let xmlData = builder.build(xmlObj);
    
    // Some minor string manipulation because XMLBuilder can't format the first line if it's treated as a normal node easily sometimes
    if (!xmlData.includes('<?xml')) {
       xmlData = `<?xml version="1.0" encoding="UTF-8"?>\n` + xmlData;
    }

    const filename = `SI_${codigoAgente}_E_${yearStr}${monthStr}_01.xml`;

    return new NextResponse(xmlData, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error: any) {
    console.error('Error generating SI CODAGE XML:', error);
    return NextResponse.json({ error: 'Error interno del servidor al generar el XML' }, { status: 500 });
  }
}
