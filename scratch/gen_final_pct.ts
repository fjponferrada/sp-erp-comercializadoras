import { Client } from 'pg';
import * as fs from 'fs';

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
        i."taxPercentage",
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

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
    const fmt2 = (n: number) => round2(n).toFixed(2);
    const fmt3 = (n: number) => round3(n).toFixed(3);
    const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;

    let csvContent05 = '';
    let csvContent511 = '';

    const data05 = { sbfoBase: 0, sbfoCantidad: 0, sbfoCuotaIntegra: 0, sbfoCuotaMinima: 0, sbfiBase: 0, sbfiCantidad: 0, sbfiCuotaIntegra: 0, sbfiCuotaMinima: 0 };
    const data511 = { sbfoBase: 0, sbfoCantidad: 0, sbfoCuotaIntegra: 0, sbfoCuotaMinima: 0, sbfiBase: 0, sbfiCantidad: 0, sbfiCuotaIntegra: 0, sbfiCuotaMinima: 0 };

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

      // The export logic: skip fully empty
      if (subtotal === 0 && energy === 0 && taxAmount === 0) continue;

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
         if (energy !== 0 && taxAmount !== 0) {
            const ratio = Math.abs(taxAmount / energy);
            if (Math.abs(ratio - 0.5) < 0.05 || Math.abs(ratio - 1.0) < 0.05) {
               isMinApplied = true;
            }
         }
      }

      let cuotaIntegra = 0;
      let cuotaMinima = 0;
      if (isMinApplied) cuotaMinima = taxAmount;
      else cuotaIntegra = taxAmount;

      let taxPct = data?.['Impuesto (%)'] ? parseNum(data['Impuesto (%)']) : (inv.taxPercentage || 5.11);
      taxPct = Math.round(taxPct * 100) / 100;

      let regimenFiscalDB = inv.regimenFiscal;
      if (!regimenFiscalDB || regimenFiscalDB === 'SBFO' || regimenFiscalDB === 'SBFI') {
         const cnaeStr = (inv.cnae || '').trim();
         const cnaePrefix = parseInt(cnaeStr.substring(0, 2), 10);
         if (!isNaN(cnaePrefix) && cnaePrefix >= 5 && cnaePrefix <= 33) {
            regimenFiscalDB = 'SBFI';
         } else {
            regimenFiscalDB = 'SBFO';
         }
      }

      // Group by Tax Pct! 
      // If min applied, taxPct is theoretically 0 in dashboard, but we need to put it somewhere.
      // We'll put all minimums in 0.5 or split them. 
      // But wait, the user's issueDate might just be easier for minimums.
      // Actually, if it's 5.11%, it goes to Jun, else AM. Let's just group by taxPct.
      const is511 = taxPct === 5.11 || (isMinApplied && new Date(inv.issueDate) >= new Date('2026-06-01T00:00:00Z'));
      
      const targetData = is511 ? data511 : data05;
      
      if (regimenFiscalDB !== 'SBFO' && regimenFiscalDB !== 'SBFI') {
         const reduccionValue = (inv.ieDiscount && inv.ieDiscount > 0) 
            ? round2(subtotal * (inv.ieDiscount / 100)) 
            : 0;
         const baseLiquidableValue = round2(subtotal - reduccionValue);

         let nifDestinatario = inv.nif || '';
         let cieDestinatario = inv.cie || ''; 
         const noNifRegimes = ['94.1', '94.2', '94.3', '94.4', '94.10'];
         if (noNifRegimes.includes(regimenFiscalDB)) nifDestinatario = '';
         const noCieRegimes = ['94.1', '94.2', '94.3', '94.4', '94.8', '94.9', '94.10', '98.2', '98.3'];
         if (noCieRegimes.includes(regimenFiscalDB)) cieDestinatario = '';

         const tarifa = data?.['Tarifa']?.toString() || '';
         const tension = tarifa.startsWith('6.') ? 'A' : '';
         const concepto = ''; 
         const cieDeclarante = '';

         const line = `${regimenFiscalDB};${cieDeclarante};${fmt2(subtotal)};${fmt2(reduccionValue)};${fmt2(baseLiquidableValue)};${fmt3(energy)};${nifDestinatario};${cieDestinatario};${tension};${concepto};${fmt2(cuotaIntegra)};${fmt2(cuotaMinima)}\n`;
         if (is511) csvContent511 += line;
         else csvContent05 += line;
      } else {
         if (regimenFiscalDB === 'SBFI') {
           targetData.sbfiBase += subtotal;
           targetData.sbfiCantidad += energy;
           targetData.sbfiCuotaIntegra += cuotaIntegra;
           targetData.sbfiCuotaMinima += cuotaMinima;
         } else {
           targetData.sbfoBase += subtotal;
           targetData.sbfoCantidad += energy;
           targetData.sbfoCuotaIntegra += cuotaIntegra;
           targetData.sbfoCuotaMinima += cuotaMinima;
         }
      }
    }

    const finalize = (csv: string, data: any) => {
      let final = csv;
      if (data.sbfoBase !== 0 || data.sbfoCantidad !== 0) {
        final += `SBFO;;${fmt2(data.sbfoBase)};0.00;${fmt2(data.sbfoBase)};${fmt3(data.sbfoCantidad)};;;;;${fmt2(data.sbfoCuotaIntegra)};${fmt2(data.sbfoCuotaMinima)}\n`;
      }
      if (data.sbfiBase !== 0 || data.sbfiCantidad !== 0) {
        final += `SBFI;;${fmt2(data.sbfiBase)};0.00;${fmt2(data.sbfiBase)};${fmt3(data.sbfiCantidad)};;;;;${fmt2(data.sbfiCuotaIntegra)};${fmt2(data.sbfiCuotaMinima)}\n`;
      }
      return final;
    };

    csvContent05 = finalize(csvContent05, data05);
    csvContent511 = finalize(csvContent511, data511);

    const qCompany = `SELECT cie FROM "Company" c JOIN "Brand" b ON b."companyId" = c.id WHERE b.id = $1 LIMIT 1`;
    const resCompany = await client.query(qCompany, [brandId]);
    const cieDeclarante = resCompany.rows[0]?.cie || 'ES00014L3007C';
    
    csvContent05 = csvContent05.replace(/;;/g, `;${cieDeclarante};`);
    csvContent511 = csvContent511.replace(/;;/g, `;${cieDeclarante};`);

    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_0.50_FINAL.txt', csvContent05);
    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_5.11_FINAL.txt', csvContent511);

    console.log("FINAL TXTs generated.");
    console.log("0.50% Cuota Integra:", data05.sbfoCuotaIntegra + data05.sbfiCuotaIntegra);
    console.log("5.11% Cuota Integra:", data511.sbfoCuotaIntegra + data511.sbfiCuotaIntegra);
    console.log("Total Minimo:", data05.sbfoCuotaMinima + data05.sbfiCuotaMinima + data511.sbfoCuotaMinima + data511.sbfiCuotaMinima);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
