import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'fs';
import path from 'path';
import { uploadFileToR2 } from '../src/lib/r2';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function uploadInvoicesFromDirectory(dirPath: string, fileType: 'pdf' | 'xml') {
  if (!fs.existsSync(dirPath)) {
    console.error(`La ruta no existe: ${dirPath}`);
    return;
  }

  const files = fs.readdirSync(dirPath).filter(f => f.toLowerCase().endsWith(`.${fileType}`));
  console.log(`Encontrados ${files.length} archivos .${fileType} en ${dirPath}`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const invoiceNumber = path.basename(filename, `.${fileType}`);
    const filePath = path.join(dirPath, filename);

    process.stdout.write(`[${i + 1}/${files.length}] Procesando ${filename}... `);

    try {
      // Buscar la factura en la base de datos
      const invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber }
      });

      if (!invoice) {
        console.log(`[SALTADO] Factura no encontrada en la base de datos.`);
        skipCount++;
        continue;
      }



      // Leer el archivo localmente
      const buffer = fs.readFileSync(filePath);

      // Subir a Cloudflare R2
      const contentType = fileType === 'pdf' ? 'application/pdf' : 'application/xml';
      const r2Url = await uploadFileToR2(`facturas/${Date.now()}-${filename}`, buffer, contentType);

      // Actualizar la base de datos
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: fileType === 'xml' 
          ? { invoiceData: { ...(invoice.invoiceData as any || {}), xmlUrl: r2Url } } 
          : { pdfUrl: r2Url }
      });

      console.log(`[OK] Subido y enlazado.`);
      successCount++;
    } catch (err: any) {
      console.log(`[ERROR] Fallo al subir: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nResumen para .${fileType}:`);
  console.log(`- Subidos con éxito: ${successCount}`);
  console.log(`- Saltados (no en BD o ya existían): ${skipCount}`);
  console.log(`- Errores: ${errorCount}\n`);
}

async function run() {
  console.log('--- INICIANDO IMPORTACIÓN LOCAL DE FACTURAS HACIA CLOUDFLARE R2 ---');

  const pdfDir = "W:\\Contabilidad\\Facturas_Clientes\\PDF\\2025_3";
  const xmlDir = "W:\\Contabilidad\\Facturas_Clientes\\E Facturas\\2025_3";

  console.log('\n>>> FASE 1: Subiendo PDFs');
  await uploadInvoicesFromDirectory(pdfDir, 'pdf');

  console.log('\n>>> FASE 2: Subiendo XMLs');
  await uploadInvoicesFromDirectory(xmlDir, 'xml');

  console.log('--- IMPORTACIÓN FINALIZADA ---');
}

run()
  .catch(e => { console.error("Error fatal:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
