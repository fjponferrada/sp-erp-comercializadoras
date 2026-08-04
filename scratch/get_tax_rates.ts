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
    const targetZona = 'España';
    const seenInvoices = new Set<string>();

    const amRates: any = {};
    const junRates: any = {};

    const targetDate = new Date('2026-06-01T00:00:00Z');

    for (const inv of invoices) {
      if (inv.invoiceNumber) {
        if (seenInvoices.has(inv.invoiceNumber)) continue;
        seenInvoices.add(inv.invoiceNumber);
      }

      const cp = (inv.postalCode || '').trim();
      const prov = (inv.province || '').toLowerCase();
      
      let zona = 'España';
      if (cp.startsWith('31') || prov.includes('navarra')) {
        zona = 'Navarra';
      } else if (cp.startsWith('01') || prov.includes('alava') || prov.includes('álava')) {
        zona = 'Álava';
      } else if (cp.startsWith('20') || prov.includes('guipuzcoa') || prov.includes('guipúzcoa') || prov.includes('gipuzkoa')) {
        zona = 'Guipúzcoa';
      } else if (cp.startsWith('48') || prov.includes('vizcaya') || prov.includes('bizkaia')) {
        zona = 'Vizcaya';
      }

      if (zona !== targetZona) continue;

      const isAbono = inv.invoiceType?.toLowerCase().includes('abono') || false;
      if (!inv.invoiceData) continue;
      const data = typeof inv.invoiceData === 'string' ? JSON.parse(inv.invoiceData) : inv.invoiceData;
      
      let subtotal = data ? parseNum(data['Subtotal 1']) : 0;
      let taxAmount = data ? parseNum(data['Importe Impuesto']) : 0;
      let energy = data ? parseNum(data['Energía Total Consumida']) : 0;
      if (energy) energy = energy / 1000;

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

      const reduccionValue = (inv.ieDiscount && inv.ieDiscount > 0) 
            ? (subtotal * (inv.ieDiscount / 100)) 
            : 0;
      const baseLiquidableValue = (subtotal - reduccionValue);

      let cuotaIntegra = 0;
      let cuotaMinima = 0;
      if (isMinApplied) cuotaMinima = taxAmount;
      else cuotaIntegra = taxAmount;

      // Determine tax rate
      let rate = '0.00';
      if (!isMinApplied && baseLiquidableValue !== 0) {
          const calculatedRate = (taxAmount / baseLiquidableValue) * 100;
          if (Math.abs(calculatedRate - 5.11) < 0.2) rate = '5.11';
          else if (Math.abs(calculatedRate - 0.5) < 0.1) rate = '0.50';
          else if (Math.abs(calculatedRate) < 0.01) rate = '0.00';
          else rate = calculatedRate.toFixed(2);
      } else if (isMinApplied) {
          rate = 'MINIMO';
      } else {
          rate = '0.00';
      }

      const isJunio = new Date(inv.issueDate).getTime() >= targetDate.getTime();
      const ratesDict = isJunio ? junRates : amRates;

      if (!ratesDict[rate]) ratesDict[rate] = { base: 0, cuota: 0, minima: 0, mwh: 0, baseLiquidable: 0 };
      ratesDict[rate].base += subtotal;
      ratesDict[rate].baseLiquidable += baseLiquidableValue;
      ratesDict[rate].cuota += cuotaIntegra;
      ratesDict[rate].minima += cuotaMinima;
      ratesDict[rate].mwh += energy;
    }

    console.log("--- ABRIL-MAYO RATES ---");
    console.log(amRates);
    console.log("--- JUNIO RATES ---");
    console.log(junRates);

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
