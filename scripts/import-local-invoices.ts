import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'fs';
import path from 'path';
import { uploadFileToR2 } from '../src/lib/r2';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function uploadInvoicesFromDirectory(dirPath: string, fileType: 'pdf' | 'xml') {
  if (!fs.existsSync(dirPath)) {
    console.error(`La ruta no existe: ${dirPath}`);
    return;
  }

  const fileNames = fs.readdirSync(dirPath).filter(f => f.toLowerCase().endsWith(`.${fileType}`));
  const files = fileNames.map(f => path.join(dirPath, f));
  console.log(`Encontrados ${files.length} archivos .${fileType} en ${dirPath}`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const filename = path.basename(filePath);
    const invoiceNumber = path.basename(filename, `.${fileType}`);

    process.stdout.write(`[${i + 1}/${files.length}] Procesando ${filename}... `);

    try {
      // Buscar la factura en la base de datos
      const invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber }
      });

      if (!invoice) {
        // console.log(`[SALTADO] Factura no encontrada en la base de datos.`);
        skipCount++;
        continue;
      }

      if (fileType === 'pdf' && invoice.pdfUrl?.startsWith('https://pub')) {
        skipCount++;
        continue;
      }

      if (fileType === 'xml' && (invoice.invoiceData as any)?.xmlUrl?.startsWith('https://pub')) {
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

    // Pequeña pausa para no saturar Prisma Accelerate / DB Pool en ráfagas rápidas
    await new Promise(r => setTimeout(r, 10));
  }

  console.log(`\nResumen para .${fileType}:`);
  console.log(`- Subidos con éxito: ${successCount}`);
  console.log(`- Saltados (no en BD o ya existían): ${skipCount}`);
  console.log(`- Errores: ${errorCount}\n`);
}

async function run() {
  console.log('--- INICIANDO IMPORTACIÓN LOCAL DE FACTURAS HACIA CLOUDFLARE R2 ---');

  const args = process.argv.slice(2);
  let pdfDir = "";
  let xmlDir = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pdfDir' && args[i + 1]) {
      pdfDir = args[i + 1];
      i++;
    } else if (args[i] === '--xmlDir' && args[i + 1]) {
      xmlDir = args[i + 1];
      i++;
    }
  }

  if (!pdfDir && !xmlDir) {
    console.error("❌ ERROR: Debes proporcionar al menos la ruta de los PDFs o la de los XMLs.");
    console.error("Uso: npx tsx scripts/import-local-invoices.ts --pdfDir \"C:\\ruta\\pdfs\" --xmlDir \"C:\\ruta\\xmls\"");
    process.exit(1);
  }

  if (pdfDir) {
    console.log(`\n>>> FASE 1: Subiendo PDFs desde ${pdfDir}`);
    await uploadInvoicesFromDirectory(pdfDir, 'pdf');
  } else {
    console.log('\n>>> FASE 1: Saltando PDFs (no se especificó --pdfDir)');
  }

  if (xmlDir) {
    console.log(`\n>>> FASE 2: Subiendo XMLs desde ${xmlDir}`);
    await uploadInvoicesFromDirectory(xmlDir, 'xml');
  } else {
    console.log('\n>>> FASE 2: Saltando XMLs (no se especificó --xmlDir)');
  }

  console.log('--- IMPORTACIÓN FINALIZADA ---');
}

run()
  .catch(e => { console.error("Error fatal:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
