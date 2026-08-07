const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cups = 'ES0143000000109354FP0F';
  
  const contracts = await prisma.contract.findMany({
    where: { supplyPoint: { cups } },
    include: { supplyPoint: true, client: true }
  });

  for (const b of contracts) {
    const airtable = (b.airtableData || {});
    console.log(`\nContract ID: ${b.id}`);
    console.log(`- Airtable PEN 2.0TD RESID: ${airtable['PEN 2.0TD RESID']}`);
    console.log(`- Airtable PEN NO RESID: ${airtable['PEN NO RESID']}`);
    console.log(`- Airtable PENALIZACIÓN CALC: ${airtable['PENALIZACIÓN CALC']}`);
    console.log(`- Airtable CONSUMO COMISION: ${airtable['CONSUMO COMISION']}`);
    
    // Simulate our calculation
    let pStart = b.permanenceStartDate ? new Date(b.permanenceStartDate) : null;
    let bDate = b.terminationDate ? new Date(b.terminationDate) : null;
    let pMonths = b.permanenceMonths || 12;
    
    if (!pStart && airtable['INICIO_PERMANENCIA']) pStart = new Date(airtable['INICIO_PERMANENCIA']);
    if (!bDate && airtable['BAJA COMERCIALIZADORA']) bDate = new Date(airtable['BAJA COMERCIALIZADORA']);
    if (!b.permanenceMonths && airtable['Meses Permanencia']) pMonths = parseInt(airtable['Meses Permanencia']) || 12;

    if (!pStart || !bDate) {
      console.log('Missing dates -> Penalty 0');
      continue;
    }
    
    const pEnd = new Date(pStart);
    pEnd.setMonth(pEnd.getMonth() + pMonths);

    console.log(`pStart: ${pStart.toISOString()}, bDate: ${bDate.toISOString()}, pEnd: ${pEnd.toISOString()}`);
    if (bDate >= pEnd) {
       console.log('bDate >= pEnd -> Penalty 0');
       continue;
    }

    const vat = (b.client?.vatNumber || '').toUpperCase().trim();
    const cnae = (b.supplyPoint?.cnae || '').trim();
    const isComunidad = vat.startsWith('H');
    const isFisica = /^[0-9XYZ]/.test(vat);
    const isCnaeHogar = cnae === '9820' || cnae === '9821';
    let isResidencial = false;
    if (isComunidad) isResidencial = true;
    else if (isFisica && isCnaeHogar) isResidencial = true;
    
    let annualCons = b.annualConsumption || b.supplyPoint?.annualConsumption || 0;
    annualCons = annualCons * 1000;
    if (!annualCons && airtable['CONSUMO COMISION']) annualCons = parseFloat(airtable['CONSUMO COMISION']) * 1000;
    
    const daysRemaining = Math.max(0, Math.ceil((pEnd.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24)));
    const expectedEnergyRemaining = (annualCons / 365) * daysRemaining;

    let energyPrice = b.p1e || 0;
    if (!energyPrice && airtable['P1E (from PRODUCTOS)']) {
      const p1eArr = airtable['P1E (from PRODUCTOS)'];
      energyPrice = Array.isArray(p1eArr) ? parseFloat(p1eArr[0]) : parseFloat(p1eArr);
    }
    
    if (!energyPrice) {
      const t = b.supplyPoint?.tariff || '';
      if (t === '2.0TD') energyPrice = 0.18;
      else if (t === '3.0TD') energyPrice = 0.17;
      else if (t.startsWith('6.')) energyPrice = 0.16;
      else energyPrice = isResidencial ? 0.18 : 0.17; 
    }

    console.log(`isResidencial: ${isResidencial}`);
    console.log(`annualCons (kWh): ${annualCons}`);
    console.log(`daysRemaining: ${daysRemaining}`);
    console.log(`expectedEnergyRemaining: ${expectedEnergyRemaining}`);
    console.log(`energyPrice: ${energyPrice}`);

    if (isResidencial) {
      const daysFromStart = Math.ceil((bDate.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24));
      if (daysFromStart <= 14) {
        console.log('daysFromStart <= 14 -> Penalty 0');
      } else {
        const energyCost = expectedEnergyRemaining * energyPrice;
        console.log(`ERP Calc: ${energyCost * 1.21 * 0.05}`);
      }
    } else {
      const energyCost = expectedEnergyRemaining * energyPrice;
      console.log(`ERP Calc: ${energyCost * 1.21 * 0.05}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
