import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole } from '@/lib/companyContext';
import { extractF1Financials, invertF1JsonForSyntheticAbono } from '@/lib/f1Utils';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !hasAdminOrBackofficeRole(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const f1s = await prisma.f1Invoice.findMany({
      orderBy: { fechaInicio: 'asc' },
    });

    let created = 0;

    for (const f1 of f1s) {
      const dGen =
        (f1.jsonData as any)?.DatosGeneralesFacturaATR?.DatosGeneralesFactura ||
        (f1.jsonData as any)?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura ||
        (f1.jsonData as any)?.DatosGeneralesFactura;
      const tipoFacturaRaw = dGen?.TipoFactura;
      const parsedTipo =
        typeof tipoFacturaRaw === 'string'
          ? tipoFacturaRaw
          : Array.isArray(tipoFacturaRaw)
            ? tipoFacturaRaw[0]
            : 'N';

      if (parsedTipo === 'R') {
        const codOriginal = dGen?.CodigoFacturaRectificadaAnulada;
        const codAbono = dGen?.CodigoFacturaAbono || (codOriginal ? `AR-${codOriginal}` : undefined);

        if (codOriginal && codAbono) {
          const strCodAbono = String(codAbono);
          const strCodOriginal = String(codOriginal);

          const existingAbono = await prisma.f1Invoice.findFirst({
            where: { numeroFactura: strCodAbono },
          });

          if (!existingAbono) {
            const originalF1 = await prisma.f1Invoice.findFirst({
              where: { numeroFactura: strCodOriginal },
            });

            if (originalF1 && originalF1.jsonData) {
              const sourceJson = originalF1.jsonData as any;
              const origEx = extractF1Financials(sourceJson, originalF1.tipoDocumento, originalF1.numeroFactura);
              const clonedJson = invertF1JsonForSyntheticAbono(sourceJson);

              if (clonedJson.DatosGeneralesFacturaATR?.DatosGeneralesFactura) {
                clonedJson.DatosGeneralesFacturaATR.DatosGeneralesFactura.TipoFactura = 'AR';
                clonedJson.DatosGeneralesFacturaATR.DatosGeneralesFactura.CodigoFiscalFactura = strCodAbono;
                clonedJson.DatosGeneralesFacturaATR.DatosGeneralesFactura.CodigoFacturaRectificadaAnulada = strCodOriginal;
              } else if (clonedJson.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura) {
                clonedJson.DatosGeneralesOtrasFacturas.DatosGeneralesFactura.TipoFactura = 'AR';
                clonedJson.DatosGeneralesOtrasFacturas.DatosGeneralesFactura.CodigoFiscalFactura = strCodAbono;
                clonedJson.DatosGeneralesOtrasFacturas.DatosGeneralesFactura.CodigoFacturaRectificadaAnulada = strCodOriginal;
              }

              const invSaldo = -Math.abs(origEx.importeTotalFactura || originalF1.saldoFactura || 0);
              const invBase = -Math.abs(origEx.baseImponible || originalF1.baseImponible || 0);
              const invPeajes = -Math.abs(origEx.totalPeajes || originalF1.totalPeajes || 0);
              const invCargos = -Math.abs(origEx.totalCargos || originalF1.totalCargos || 0);

              await prisma.f1Invoice.create({
                data: {
                  numeroFactura: strCodAbono,
                  tipoDocumento: originalF1.tipoDocumento || 'FacturaATR',
                  fechaEmision: f1.fechaEmision,
                  fechaInicio: originalF1.fechaInicio,
                  fechaFin: originalF1.fechaFin,
                  saldoFactura: invSaldo,
                  baseImponible: invBase,
                  totalPeajes: invPeajes,
                  totalCargos: invCargos,
                  xmlUrl: f1.xmlUrl || originalF1.xmlUrl,
                  jsonData: clonedJson,
                  supplyPointId: originalF1.supplyPointId,
                  contractId: originalF1.contractId,
                  facturaRealizada: true,
                },
              });
              created++;
            }
          }
        }
      }
    }
    return NextResponse.json({ message: `Revisión completada. Se generaron ${created} abonos (AR) omitidos.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
