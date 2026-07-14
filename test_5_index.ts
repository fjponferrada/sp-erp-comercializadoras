async function main() {
  const { prisma } = await import('./src/lib/prisma');
  const { InternalBillingEngine } = await import('./src/lib/services/InternalBillingEngine');
  
  const f1s = await prisma.f1Invoice.findMany({
    where: { 
      invoices: { some: {} },
      contract: { 
        OR: [
          { pricingModel: 'Precio indexado' },
          { airtableData: { path: ['FIJO / INDEX'], equals: 'I' } }
        ]
      }
    },
    take: 5,
    include: {
      contract: true,
      invoices: true
    }
  });

  console.log("=========================================");
  console.log("DESGLOSE EXACTO: 5 FACTURAS INDEXADAS");
  console.log("=========================================\n");

  for (let i = 0; i < f1s.length; i++) {
    const f1 = f1s[i];
    const issued = f1.invoices[0];
    const data = issued.jsonData as any;

    try {
      const result = await InternalBillingEngine.calculate(f1.id);
      
      console.log(`[Factura ${i + 1}] F1 ID: ${f1.id} | Emitida: ${issued.invoiceNumber}`);
      console.log(`  -- PROVEEDOR (IssuedInvoice) --`);
      // Extrayendo el desglose desde el issued.jsonData asumiendo estructura de los PDF
      let provPower = 0, provAtr = 0, provActiva = 0, provBono = 0, provAlquiler = 0, provIe = 0, provBase = 0;
      
      if (data && data.lineas) {
        // En una factura AED típica, a veces el JSON viene diferente, vamos a intentar ver qué campos tiene el DB model.
      }
      
      console.log(`     Total Base Imponible: ${issued.baseImponible?.toFixed(2) || 'N/A'} €`);
      console.log(`     Total Factura: ${issued.totalAmount?.toFixed(2) || 'N/A'} €`);
      console.log(`     Total MWh facturado: ${issued.totalMWh ? (issued.totalMWh / 1000).toFixed(3) : 'N/A'}`);
      
      console.log(`  -- MOTOR ERP --`);
      console.log(`     Coste Mercado (Activa): ${result.energyCost.toFixed(2)} €`);
      console.log(`     FEE: ${result.feeCost.toFixed(2)} €`);
      console.log(`     Coste ATR Energía (Peajes+Cargos): ${(result.peajesDistribuidora + result.cargosDistribuidora).toFixed(2)} €`);
      console.log(`     Potencia Facturada: ${result.powerCost.toFixed(2)} €`);
      console.log(`     Bono Social: ${result.bonoSocial.toFixed(2)} €`);
      console.log(`     Alquiler: ${result.alquilerEquipo.toFixed(2)} €`);
      console.log(`     Capacidad + FNEE (ocultos en precio): ${(result.capacityCost + result.fneeCost).toFixed(2)} €`);
      console.log(`     Base Imponible: ${result.totalBase.toFixed(2)} €`);
      console.log(`     Impuesto Eléctrico: ${result.taxElectric.toFixed(2)} €`);
      console.log(`     Total Factura: ${result.totalAmount.toFixed(2)} €`);
      console.log(`     Total MWh F1/Contador: ${result.totalF1MWh.toFixed(3)}`);
      
      console.log(`\n  >> DIFERENCIA BASE IMPONIBLE: ${(result.totalBase - (issued.baseImponible || 0)).toFixed(2)} €\n`);
    } catch (e: any) {
      console.log(`[Factura ${i + 1}] ID: ${f1.id} | ERROR: ${e.message}\n`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
