import { PricingEngine } from './src/lib/services/PricingEngine';

async function testPricing() {
  const quote = await PricingEngine.generateQuote({
    tariff: '2.0TD',
    margin: 0,
    deviations: 2.5,
    annualConsumptionKwh: 10000,
    startDate: '2026-07-13',
    durationMonths: 12,
    riskLevel: 2
  });

  console.log('Flat Price:', quote.flatPriceEurMwh);
  console.log('Regulated Total:', quote.totals.regTotalEur);
  console.log('Energy Total:', quote.totals.energiaPuraEur);
  console.log('Subtotal:', quote.totals.subtotalEur);
  console.log('Tasa Municipal:', quote.totals.tasaMunicEur);
  
  if (quote.hourlyDetails.length > 0) {
    console.log('First hour detail:', quote.hourlyDetails[0]);
  }
}

testPricing().catch(console.error);
