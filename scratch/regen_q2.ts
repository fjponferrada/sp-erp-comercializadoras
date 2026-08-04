import { prisma } from '../src/lib/prisma';
import fs from 'fs';

async function run() {
  try {
    const year = 2026;
    
    // Q2
    const startDate = new Date(Date.UTC(year, 3, 1)); // April 1
    const endDate = new Date(Date.UTC(year, 6, 1));   // July 1 (exclusive)

    const invoices = await prisma.invoice.findMany({
      where: {
        issueDate: {
          gte: startDate,
          lt: endDate,
        },
        invoiceType: { in: ['FACTURA', 'ABONO'] }
      },
      include: {
        supplyPoint: true
      }
    });

    let totalCuota = 0;
    let totalBase = 0;

    const dataAbrilMayo = {
      sbfoBase: 0, sbfoCuota: 0, sbfoMwh: 0, sbfoMin: 0,
      sbfiBase: 0, sbfiCuota: 0, sbfiMwh: 0, sbfiMin: 0,
      lines98: [] as any[]
    };

    const dataJunio = {
      sbfoBase: 0, sbfoCuota: 0, sbfoMwh: 0, sbfoMin: 0,
      sbfiBase: 0, sbfiCuota: 0, sbfiMwh: 0, sbfiMin: 0,
      lines98: [] as any[]
    };

    for (const inv of invoices) {
      if (inv.subtotal1 === 0) continue;
      
      const sp = inv.supplyPoint;
      if (!sp) continue;

      let amount = Number(inv.subtotal1) || 0;
      let tax = Number(inv.taxAmount) || 0;
      let mwh = (Number(inv.totalMWh) || 0);

      if (inv.invoiceType === 'ABONO') {
        amount = -Math.abs(amount);
        tax = -Math.abs(tax);
        mwh = -Math.abs(mwh);
      }

      totalCuota += tax;
      totalBase += amount;

      const isJunio = inv.issueDate.getUTCMonth() === 5; // 5 is June
      const target = isJunio ? dataJunio : dataAbrilMayo;

      const isProfessional = sp.tariff === '3.0TD' || sp.tariff === '6.1TD';
      const minTaxRate = isProfessional ? 0.5 : 1.0;
      let minTax = mwh * minTaxRate;
      if (minTax < 0) minTax = -Math.abs(minTax);

      let applicableMinTax = 0;
      if (Math.abs(tax) < Math.abs(minTax)) {
        applicableMinTax = minTax;
      }

      if (sp.regimenFiscal === '98.1E') {
        const reduccion = amount * 0.85;
        const liquidable = amount - reduccion;
        target.lines98.push({
          base: amount,
          reduccion,
          liquidable,
          mwh,
          cuota: tax
        });
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
      
      const lines98_1E = new Map<string, any>();
      for (const line of data.lines98) {
         lines.push(formatLine('98.1E', line.base, line.reduccion, line.liquidable, line.mwh, line.cuota, 0));
      }
      lines.push(formatLine('SBFO', data.sbfoBase, 0, data.sbfoBase, data.sbfoMwh, data.sbfoCuota, data.sbfoMin));
      lines.push(formatLine('SBFI', data.sbfiBase, 0, data.sbfiBase, data.sbfiMwh, data.sbfiCuota, data.sbfiMin));
      return lines.filter(Boolean).join('\n') + '\n';
    };

    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Abril_Mayo_0.5.txt', buildTxt(dataAbrilMayo));
    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Junio_5.11.txt', buildTxt(dataJunio));
    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2 (4).txt', buildTxt({
        sbfoBase: dataAbrilMayo.sbfoBase + dataJunio.sbfoBase,
        sbfoCuota: dataAbrilMayo.sbfoCuota + dataJunio.sbfoCuota,
        sbfoMwh: dataAbrilMayo.sbfoMwh + dataJunio.sbfoMwh,
        sbfoMin: dataAbrilMayo.sbfoMin + dataJunio.sbfoMin,
        sbfiBase: dataAbrilMayo.sbfiBase + dataJunio.sbfiBase,
        sbfiCuota: dataAbrilMayo.sbfiCuota + dataJunio.sbfiCuota,
        sbfiMwh: dataAbrilMayo.sbfiMwh + dataJunio.sbfiMwh,
        sbfiMin: dataAbrilMayo.sbfiMin + dataJunio.sbfiMin,
        lines98: [...dataAbrilMayo.lines98, ...dataJunio.lines98]
    }));

    console.log(`Regenerated TXTs for Q2. Total Cuota: ${totalCuota}`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
