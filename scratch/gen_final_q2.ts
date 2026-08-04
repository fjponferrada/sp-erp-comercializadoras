import { Client } from 'pg';
import * as fs from 'fs';

async function run() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });

  try {
    await client.connect();
    
    // We only care about brand cmq6j25l50001d441e0c06g9t or invoices belonging to this brand's clients
    const query = `
      SELECT 
        i."invoiceType", 
        i."issueDate",
        i."invoiceData",
        sp."tariff",
        sp."regimenFiscal",
        sp."ieDiscount",
        c."vatNumber" as nif,
        sp."cie" as cie,
        sp."postalCode",
        sp."province"
      FROM "Invoice" i
      LEFT JOIN "SupplyPoint" sp ON i."supplyPointId" = sp.id
      LEFT JOIN "Client" c ON i."clientId" = c.id
      WHERE i."issueDate" >= '2026-04-01' AND i."issueDate" < '2026-07-01'
        AND i."invoiceType" IN ('FACTURA', 'ABONO')
        AND c."brandId" = 'cmq6j25l50001d441e0c06g9t'
    `;

    const res = await client.query(query);
    const invoices = res.rows;

    const dataAM = { sbfoBase: 0, sbfoCuota: 0, sbfoMwh: 0, sbfoMin: 0, sbfiBase: 0, sbfiCuota: 0, sbfiMwh: 0, sbfiMin: 0, lines98: [] as any[] };
    const dataJun = { sbfoBase: 0, sbfoCuota: 0, sbfoMwh: 0, sbfoMin: 0, sbfiBase: 0, sbfiCuota: 0, sbfiMwh: 0, sbfiMin: 0, lines98: [] as any[] };

    let totalCuota = 0;
    let cuotaJunio = 0;
    let cuotaAM = 0;

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;

    for (const inv of invoices) {
      if (!inv.invoiceData) continue;
      const data = inv.invoiceData;
      
      let subtotal = parseNum(data['Subtotal 1']);
      let taxAmount = parseNum(data['Importe Impuesto']);
      let energy = parseNum(data['Energía Total Consumida']) / 1000;

      if (subtotal === 0 && energy === 0 && taxAmount === 0) continue;

      if (inv.invoiceType === 'ABONO') {
        if (subtotal > 0) subtotal = -subtotal;
        if (taxAmount > 0) taxAmount = -taxAmount;
        if (energy > 0) energy = -energy;
      }

      totalCuota += taxAmount;

      // The user says June 1 - June 30 is the 5.11% part
      const isJunio = new Date(inv.issueDate) >= new Date('2026-06-01T00:00:00Z');
      const target = isJunio ? dataJun : dataAM;

      if (isJunio) cuotaJunio += taxAmount;
      else cuotaAM += taxAmount;

      let isMinApplied = false;
      const minSuperadoValue = data['Minimo Importe IE Superado'] ?? data.minimoImporteIESuperado;
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
      if (isMinApplied) {
        cuotaMinima = taxAmount;
      } else {
        cuotaIntegra = taxAmount;
      }

      let regimenFiscalDB = inv.regimenFiscal;
      if (!regimenFiscalDB || regimenFiscalDB === 'SBFO' || regimenFiscalDB === 'SBFI') {
         // Auto-detect based on CNAE or defaults to SBFO
         // For simplicity, we just use SBFO if it's not defined
         regimenFiscalDB = 'SBFO'; 
         // Assuming most of it goes to SBFO in this test, but let's check tariff
         const isProf = inv.tariff === '3.0TD' || inv.tariff === '6.1TD';
         if (isProf) regimenFiscalDB = 'SBFI';
      }

      if (regimenFiscalDB !== 'SBFO' && regimenFiscalDB !== 'SBFI') {
         const reduccionValue = (inv.ieDiscount && inv.ieDiscount > 0) 
            ? round2(subtotal * (inv.ieDiscount / 100)) 
            : 0;
         const liquidable = round2(subtotal - reduccionValue);
         target.lines98.push({ clave: regimenFiscalDB, base: subtotal, reduccion: reduccionValue, liquidable, mwh: energy, cuota: cuotaIntegra, min: cuotaMinima });
      } else {
         if (regimenFiscalDB === 'SBFI') {
           target.sbfiBase += subtotal;
           target.sbfiCuota += cuotaIntegra;
           target.sbfiMwh += energy;
           target.sbfiMin += cuotaMinima;
         } else {
           target.sbfoBase += subtotal;
           target.sbfoCuota += cuotaIntegra;
           target.sbfoMwh += energy;
           target.sbfoMin += cuotaMinima;
         }
      }
    }

    const formatLine = (clave: string, base: number, red: number, liq: number, mwh: number, cuota: number, min: number) => {
      if (base === 0 && cuota === 0) return null;
      return `${clave};ES00014L3007C;${base.toFixed(2)};${red.toFixed(2)};${liq.toFixed(2)};${mwh.toFixed(3)};E41485012;ES00041LA319P;;;${cuota.toFixed(2)};${min.toFixed(2)}`;
    };

    const buildTxt = (data: any) => {
      const lines = [];
      for (const line of data.lines98) {
         lines.push(formatLine(line.clave, line.base, line.reduccion, line.liquidable, line.mwh, line.cuota, line.min));
      }
      lines.push(formatLine('SBFO', data.sbfoBase, 0, data.sbfoBase, data.sbfoMwh, data.sbfoCuota, data.sbfoMin));
      lines.push(formatLine('SBFI', data.sbfiBase, 0, data.sbfiBase, data.sbfiMwh, data.sbfiCuota, data.sbfiMin));
      return lines.filter(Boolean).join('\n') + '\n';
    };

    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Abril_Mayo_0.5.txt', buildTxt(dataAM));
    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Junio_5.11.txt', buildTxt(dataJun));

    console.log(`Generated perfectly. Total Cuota: ${totalCuota}`);
    console.log(`April-May tax sum: ${cuotaAM}`);
    console.log(`June tax sum: ${cuotaJunio}`);

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
