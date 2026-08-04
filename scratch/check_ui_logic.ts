import { Client } from 'pg';

async function run() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });

  try {
    await client.connect();
    
    const brandId = 'cmq6j25l50001d441e0c06g9t';

    const query = `
      SELECT 
        i."invoiceNumber",
        i."invoiceType", 
        i."issueDate",
        i."invoiceData",
        sp."tariff",
        sp."regimenFiscal",
        sp."ieDiscount",
        c."vatNumber" as nif,
        sp."cie" as cie,
        sp."postalCode",
        sp."province",
        sp.cnae
      FROM "Invoice" i
      LEFT JOIN "SupplyPoint" sp ON i."supplyPointId" = sp.id
      LEFT JOIN "Client" c ON i."clientId" = c.id
      WHERE i."issueDate" >= '2026-04-01' AND i."issueDate" < '2026-07-01'
        AND c."brandId" = $1
    `;

    const res = await client.query(query, [brandId]);
    const invoices = res.rows;

    const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;

    let amBase = 0;
    let amCuotaIntegra = 0;
    let amCuotaMinima = 0;
    let amMwh = 0;

    let junBase = 0;
    let junCuotaIntegra = 0;
    let junCuotaMinima = 0;
    let junMwh = 0;

    const seenInvoices = new Set<string>();

    for (const inv of invoices) {
      if (inv.invoiceNumber) {
        if (seenInvoices.has(inv.invoiceNumber)) continue;
        seenInvoices.add(inv.invoiceNumber);
      }

      const isAbono = inv.invoiceType?.toLowerCase().includes('abono') || false;
      if (!inv.invoiceData) continue;
      const data = typeof inv.invoiceData === 'string' ? JSON.parse(inv.invoiceData) : inv.invoiceData;
      
      let subtotal = data ? parseNum(data['Subtotal 1']) : 0;
      let taxAmount = data ? parseNum(data['Importe Impuesto']) : 0;
      let energy = data ? parseNum(data['Energía Total Consumida']) : 0;
      if (energy) energy = energy / 1000;

      // Dashboard logic: EXACTLY
      if (taxAmount === 0) continue;

      if (isAbono) {
        if (subtotal > 0) subtotal = -subtotal;
        if (taxAmount > 0) taxAmount = -taxAmount;
        if (energy > 0) energy = -energy;
      }

      let isMinApplied = false;
      const minSuperadoValue = data ? (data['Minimo Importe IE Superado'] ?? data.minimoImporteIESuperado) : undefined;
      
      if (minSuperadoValue !== undefined && String(minSuperadoValue).trim() !== '') {
         const flag = String(minSuperadoValue).trim().toLowerCase();
         isMinApplied = flag === '0' || flag === 'false';
      } else {
         if (energy !== 0) {
            const ratio = Math.abs(taxAmount / energy);
            if (Math.abs(ratio - 0.5) < 0.05 || Math.abs(ratio - 1.0) < 0.05) {
               isMinApplied = true;
            }
         }
      }

      const isJunio = new Date(inv.issueDate) >= new Date('2026-06-01T00:00:00Z');
      
      if (isJunio) {
         if (isMinApplied) {
            junMwh += energy;
            junCuotaMinima += taxAmount;
         } else {
            junBase += subtotal;
            junCuotaIntegra += taxAmount;
         }
      } else {
         if (isMinApplied) {
            amMwh += energy;
            amCuotaMinima += taxAmount;
         } else {
            amBase += subtotal;
            amCuotaIntegra += taxAmount;
         }
      }
    }

    console.log("Abril-Mayo:");
    console.log({ base: amBase, cuotaIntegra: amCuotaIntegra, cuotaMinima: amCuotaMinima, mwh: amMwh });
    console.log("Junio:");
    console.log({ base: junBase, cuotaIntegra: junCuotaIntegra, cuotaMinima: junCuotaMinima, mwh: junMwh });

    console.log("TOTAL COMBINADO:");
    console.log({
      baseTotal: amBase + junBase,
      cuotaIntegra: amCuotaIntegra + junCuotaIntegra,
      cuotaMinima: amCuotaMinima + junCuotaMinima
    });
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
