import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
async function main() {
  const f1s = await prisma.f1Invoice.findMany({
    where: { supplyPoint: { cups: { startsWith: 'ES0031101352266001VX0F' } } },
    orderBy: { fechaInicio: 'asc' }
  });
  console.log('ID | NumeroFactura | F.Inicio | F.Fin | Tipo | Original(R) | Abono(R)');
  for (const f1 of f1s) {
    const dGen = (f1.jsonData as any)?.DatosGeneralesFacturaATR?.DatosGeneralesFactura || (f1.jsonData as any)?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura || (f1.jsonData as any)?.DatosGeneralesFactura;
    const tipo = typeof dGen?.TipoFactura === 'string' ? dGen.TipoFactura : (Array.isArray(dGen?.TipoFactura) ? dGen.TipoFactura[0] : 'N');
    const original = dGen?.CodigoFacturaRectificadaAnulada || '-';
    const abono = dGen?.CodigoFacturaAbono || '-';
    console.log(`${f1.id} | ${f1.numeroFactura} | ${f1.fechaInicio.toISOString().split('T')[0]} | ${f1.fechaFin.toISOString().split('T')[0]} | ${tipo} | ${original} | ${abono}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
