const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cups = 'ES0031104831144001SS0F';
  
  const contracts = await prisma.contract.findMany({
    where: { supplyPoint: { cups } },
    include: { supplyPoint: true, client: true, product: true }
  });

  if (contracts.length === 0) {
    console.log(`No contracts found for ${cups}`);
    return;
  }

  for (const b of contracts) {
    const airtable = (b.airtableData || {});
    console.log(`\n======================================`);
    console.log(`Contract ID: ${b.id}`);
    console.log(`CUPS: ${cups}`);
    console.log(`Client Type: ${b.client?.type}`);
    console.log(`Tariff: ${b.supplyPoint?.tariff}`);
    console.log(`VAT: ${b.client?.vatNumber}`);
    console.log(`CNAE: ${b.supplyPoint?.cnae}`);
    
    console.log(`\n--- AIRTABLE RAW DATA ---`);
    console.log(`INICIO_PERMANENCIA: ${airtable['INICIO_PERMANENCIA']}`);
    console.log(`BAJA COMERCIALIZADORA: ${airtable['BAJA COMERCIALIZADORA']}`);
    console.log(`Meses Permanencia: ${airtable['Meses Permanencia']}`);
    console.log(`CONSUMO COMISION (MWh): ${airtable['CONSUMO COMISION']}`);
    console.log(`PEN 2.0TD RESID: ${airtable['PEN 2.0TD RESID']}`);
    console.log(`PEN NO RESID: ${airtable['PEN NO RESID']}`);
    console.log(`PENALIZACIÓN CALC: ${airtable['PENALIZACIÓN CALC']}`);
    console.log(`P1E: ${airtable['P1E (from PRODUCTOS)']}`);
    console.log(`POTENCIA: P1P=${airtable['P1P (from P.S)']}, P1C=${airtable['P1C (from PRODUCTOS)']}`);

    console.log(`\n--- ERP CALCULATION TRACE ---`);
    
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

    console.log(`Start Date: ${pStart.toISOString().split('T')[0]}`);
    console.log(`Baja Date: ${bDate.toISOString().split('T')[0]}`);
    console.log(`End Date (pStart + ${pMonths}m): ${pEnd.toISOString().split('T')[0]}`);
    
    if (bDate >= pEnd) {
       console.log('Baja is after End Date -> Penalty 0');
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
    
    const diffTimeDays = (pEnd.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, Math.ceil(diffTimeDays));
    const expectedEnergyRemaining = (annualCons / 365) * daysRemaining;

    let energyPrice = b.p1e || 0;
    if (!energyPrice && airtable['P1E (from PRODUCTOS)']) {
      const p1eArr = airtable['P1E (from PRODUCTOS)'];
      energyPrice = Array.isArray(p1eArr) ? parseFloat(p1eArr[0]) : parseFloat(p1eArr);
    }
    
    let isFallback = false;
    if (!energyPrice) {
      isFallback = true;
      const t = b.supplyPoint?.tariff || '';
      if (t === '2.0TD') energyPrice = 0.18;
      else if (t === '3.0TD') energyPrice = 0.17;
      else if (t.startsWith('6.')) energyPrice = 0.16;
      else energyPrice = isResidencial ? 0.18 : 0.17; 
    }

    console.log(`Is Residencial: ${isResidencial} (Comunidad=${isComunidad}, Fisica=${isFisica}, CNAEHogar=${isCnaeHogar})`);
    console.log(`Annual Consumption (kWh): ${annualCons.toFixed(2)}`);
    console.log(`Days Remaining: ${daysRemaining} (${diffTimeDays.toFixed(2)} exact)`);
    console.log(`Expected Energy Remaining (kWh): ${expectedEnergyRemaining.toFixed(2)}`);
    console.log(`Energy Price (€/kWh): ${energyPrice} ${isFallback ? '(Fallback)' : '(Real)'}`);

    if (isResidencial) {
      const daysFromStart = Math.ceil((bDate.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24));
      if (daysFromStart <= 14) {
        console.log(`Desistimiento: Baja at day ${daysFromStart} (<= 14) -> Penalty 0`);
      } else {
        const energyCost = expectedEnergyRemaining * energyPrice;
        console.log(`Base Imponible (Energy Remaining * Price): ${energyCost.toFixed(2)} €`);
        const penalty = energyCost * 1.21 * 0.05;
        console.log(`ERP Final Penalty (Base * 1.21 * 0.05): ${penalty.toFixed(2)} €`);
      }
    } else {
      const energyCost = expectedEnergyRemaining * energyPrice;
      console.log(`Base Imponible (Energy Remaining * Price): ${energyCost.toFixed(2)} €`);
      const penalty = energyCost * 1.21 * 0.05;
      console.log(`ERP Final Penalty (Base * 1.21 * 0.05): ${penalty.toFixed(2)} €`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
