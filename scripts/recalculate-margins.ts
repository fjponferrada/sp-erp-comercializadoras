import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log("Iniciando recálculo de márgenes para facturas existentes...");

  const totalInvoices = await prisma.invoice.count();
  console.log(`Se encontraron ${totalInvoices} facturas. Procesando en lotes...`);
  
  let updatedCount = 0;
  const batchSize = 1000;

  for (let offset = 0; offset < totalInvoices; offset += batchSize) {
    const invoices = await prisma.invoice.findMany({
      skip: offset,
      take: batchSize,
      include: { contract: true }
    });

    for (const invoice of invoices) {
      const invData: any = invoice.invoiceData;
      if (!invData) continue;

      const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;

      let margenEnergia = parseNum(invData['Margen Energia']);
      let margenFactura = parseNum(invData['Margen Factura']);
      let margenPotencia = parseNum(invData['Margen Potencia']);
      let fijoIndex = invData['FIJO / INDEX'] || 'Fijo';
      
      let fee = invoice.contract && invoice.contract.fee != null ? invoice.contract.fee : (parseNum(invData['Fee Index']) || parseNum(invData['FEE']) || 0);

      let cantidadEnergia = parseNum(invData['Cantidad Energía Total Consumida CORR'] || invData['Energía Total Consumida'] || invData['Consumo']);
      let baseImponibleIva = parseNum(invData['Base Imponible IVA CORR'] || invData['Base Imponible IVA']);
      let importeImpuesto = parseNum(invData['Importe Impuesto CORR'] || invData['Importe Impuesto']);
      let baseImponibleF1 = parseNum(invData['BaseImponibleF1 CORR'] || invData['BaseImponibleF1']);
      let tipoFactura = invData['Tipo Factura'] || invoice.invoiceType || 'Normal';

      // 1. Margen Rel Ingebau
      let margenRelIngebau = 0;
      if (cantidadEnergia !== 0) {
          margenRelIngebau = 1000 * margenEnergia / cantidadEnergia;
      }

      // 2. Margen Factura Corr
      let margenFacturaCorr = (tipoFactura === 'Abono' ? -1 : 1) * margenFactura;

      // 3. Margen Estimado
      let margenEstimado = 0;
      if (fijoIndex === 'Indexado') {
          margenEstimado = margenPotencia + fee * (cantidadEnergia / 1000);
      } else {
          margenEstimado = Math.abs(baseImponibleIva) - importeImpuesto - baseImponibleF1 - 0.09 * cantidadEnergia;
      }
      if (tipoFactura === 'Abono') {
          margenEstimado = -Math.abs(margenEstimado);
      }

      // 4. Margen Final
      let finalMargin = 0;
      if (margenRelIngebau < 70 && margenRelIngebau > -70) {
          finalMargin = margenFacturaCorr;
      } else {
          finalMargin = margenEstimado;
      }

      await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
              margin: finalMargin
          }
      });

      updatedCount++;
    }
    console.log(`  Procesadas ${offset + invoices.length} / ${totalInvoices} facturas...`);
  }

  console.log(`¡Recálculo finalizado! Se han actualizado ${updatedCount} facturas.`);
}

run().catch(e => { 
    console.error("Error fatal:", e); 
    process.exit(1); 
}).finally(async () => { 
    await prisma.$disconnect(); 
});
