import { Client } from 'pg';
import * as fs from 'fs';

async function run() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL via pg!");

    const query = `
      SELECT 
        i."invoiceType", 
        i."subtotal1", 
        i."taxAmount", 
        i."taxPercentage", 
        i."totalMWh",
        sp."tariff",
        sp."regimenFiscal"
      FROM "Invoice" i
      LEFT JOIN "SupplyPoint" sp ON i."supplyPointId" = sp.id
      WHERE i."issueDate" >= '2026-04-01' AND i."issueDate" < '2026-07-01'
        AND i."invoiceType" IN ('FACTURA', 'ABONO')
        AND i."subtotal1" != 0
    `;

    const res = await client.query(query);
    const invoices = res.rows;

    let totalCuota = 0;
    
    const data05 = { sbfoBase: 0, sbfoCuota: 0, sbfoMwh: 0, sbfoMin: 0, sbfiBase: 0, sbfiCuota: 0, sbfiMwh: 0, sbfiMin: 0, lines98: [] as any[] };
    const data511 = { sbfoBase: 0, sbfoCuota: 0, sbfoMwh: 0, sbfoMin: 0, sbfiBase: 0, sbfiCuota: 0, sbfiMwh: 0, sbfiMin: 0, lines98: [] as any[] };

    for (const inv of invoices) {
      let amount = Number(inv.subtotal1) || 0;
      let tax = Number(inv.taxAmount) || 0;
      let mwh = Number(inv.totalMWh) || 0;
      const taxPct = Number(inv.taxPercentage) || 0;

      if (inv.invoiceType === 'ABONO') {
        amount = -Math.abs(amount);
        tax = -Math.abs(tax);
        mwh = -Math.abs(mwh);
      }

      totalCuota += tax;

      // Group by Tax Percentage instead of Date!
      const target = (taxPct > 2.0) ? data511 : data05; // 5.11% vs 0.5%

      const isProfessional = inv.tariff === '3.0TD' || inv.tariff === '6.1TD';
      const minTaxRate = isProfessional ? 0.5 : 1.0;
      let minTax = mwh * minTaxRate;
      if (minTax < 0) minTax = -Math.abs(minTax);

      let applicableMinTax = 0;
      if (Math.abs(tax) < Math.abs(minTax)) {
        applicableMinTax = minTax;
      }

      if (inv.regimenFiscal === '98.1E') {
        const reduccion = amount * 0.85;
        const liquidable = amount - reduccion;
        target.lines98.push({ base: amount, reduccion, liquidable, mwh, cuota: tax });
      } else if (isProfessional) {
        target.sbfiBase += amount;
        target.sbfiCuota += tax;
        target.sbfiMwh += mwh;
        target.sbfiMin += applicableMinTax;
      } else {
        target.sbfoBase += amount;
        target.sbfoCuota += tax;
        target.sbfoMwh += mwh;
        target.sbfoMin += applicableMinTax;
      }
    }

    const formatLine = (clave: string, base: number, red: number, liq: number, mwh: number, cuota: number, min: number) => {
      if (base === 0 && cuota === 0) return null;
      return `${clave};ES00014L3007C;${base.toFixed(2)};${red.toFixed(2)};${liq.toFixed(2)};${mwh.toFixed(3)};E41485012;ES00041LA319P;;;${cuota.toFixed(2)};${min.toFixed(2)}`;
    };

    const buildTxt = (data: any) => {
      const lines = [];
      for (const line of data.lines98) {
         lines.push(formatLine('98.1E', line.base, line.reduccion, line.liquidable, line.mwh, line.cuota, 0));
      }
      lines.push(formatLine('SBFO', data.sbfoBase, 0, data.sbfoBase, data.sbfoMwh, data.sbfoCuota, data.sbfoMin));
      lines.push(formatLine('SBFI', data.sbfiBase, 0, data.sbfiBase, data.sbfiMwh, data.sbfiCuota, data.sbfiMin));
      return lines.filter(Boolean).join('\n') + '\n';
    };

    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Puro_0.5.txt', buildTxt(data05));
    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Puro_5.11.txt', buildTxt(data511));

    console.log(`Generated TXTs by TAX PCT. Total Cuota: ${totalCuota}`);
    console.log(`0.5% file tax sum: ${data05.sbfoCuota + data05.sbfiCuota + data05.lines98.reduce((a,b)=>a+b.cuota,0)}`);
    console.log(`5.11% file tax sum: ${data511.sbfoCuota + data511.sbfiCuota + data511.lines98.reduce((a,b)=>a+b.cuota,0)}`);

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
