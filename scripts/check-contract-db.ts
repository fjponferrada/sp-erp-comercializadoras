import { prisma } from '../src/lib/prisma';

const ghostFields = [
  'isB2B', 'peticionClienteC2', 'tipoEntrada', 'captacionCliente', 'autoconsumoFijoIndex', 
  'atrComer', 'unPrecio', 'cierre', 'feeP', 'descuentoCie', 'inicioProceso', 'gasIncluido', 
  'modalidadContrato', 'fechaProceso', 'fechaIncidencia', 'sinComision', 'm1Activado', 
  'm1Rechazado', 'decomision', 'decomision50', 'comision50', 'renovacion', 'bajaPorM1RE1', 
  'bimensual', 'sinPenalizacion', 'sinDecomision', 'svaAnadidoTera', 'penalizacionFacturada', 
  'numFacturaPenalizacion', 'facturarPen', 'biPen', 'ivaPen', 'penalizacionEstimada', 'abonar', 
  'fechaFacturaPenalizacion', 'ajustePen', 'productoRenovacion', 'renovacionSolicitada', 
  'servicioRenovacion', 'renovacionTramitada', 'derechosExtension', 'telegestion', 
  'estadoCompilacion', 'calculoCodDistri', 'nombreComercial', 'ip', 'fc', 'porcComisionFijo', 
  'porcComisionVariable', 'ajusteConsumoComision', 'comisionAjustada', 'ajusteComisionDuracionPotencia', 
  'decomisionSobreAjuste', 'm1sSolicitado', 'm1nSolicitado', 'tipoPm', 'calculoMesAlta', 
  'calculoMesBaja', 'mesAlta', 'mesBaja', 'ultimoDiaFacturado', 'ultDiaAFacturar', 'retraso', 
  'inicioMes0', 'inicioMesMinus1', 'finMesMinus1', 'energiaPteMesMinus1', 'inicioMesMinus2', 
  'finMesMinus2', 'energiaPteMesMinus2', 'energiaPteMes0HastaHoy', 'finMes0', 'ultDiaFact', 
  'energiaPteMes0HastaFinMes', 'firmaManRenov', 'consumoRealEstimado', 'pen20TdResid', 
  'penNoResid', 'pen20TdResidHoy', 'horasUsoDiarios', 'tipoEnvioFacturaRenov', 'diasContrato', 
  'diasRenovMax', 'filePdfDraft', 'filePdfSigned', 'estadoPrevio', 'fechaVencimientoCalculada'
];

async function main() {
  const notEmptyFields = [];
  const emptyFields = [];

  for (const field of ghostFields) {
    // For boolean fields, 'not null' means they might be true or false. Prisma schema has them as optional `Boolean?`
    // We can just query `where: { [field]: { not: null } }`
    const record = await prisma.contract.findFirst({
      where: {
        [field]: { not: null }
      }
    });

    if (record) {
      notEmptyFields.push(field);
    } else {
      emptyFields.push(field);
    }
  }

  console.log("=== FIELDS WITH DATA (NOT EMPTY) ===");
  console.log(notEmptyFields.join(', '));
  console.log(`\nTotal fields with data: ${notEmptyFields.length}`);

  console.log("\n=== FIELDS EMPTY ===");
  console.log(emptyFields.join(', '));
  console.log(`\nTotal empty fields: ${emptyFields.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
