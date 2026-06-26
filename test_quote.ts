import { PricingEngine } from './src/lib/services/PricingEngine';

async function main() {
  try {
    const result = await PricingEngine.generateQuote({
      tariff: '2.0TD',
      margin: 0,
      deviations: 2,
      annualConsumptionKwh: 10000,
      startDate: '2026-06-26',
      durationMonths: 12,
      riskLevel: 1
    });
    
    console.log("Flat Price:", result.flatPriceEurMwh);
    console.log("Breakdown:", result.breakdown);
    console.log("First 5 hours Base Mercado:", result.hourlyDetails.slice(0, 5).map(h => h.baseMercadoEur));
  } catch (e) {
    console.error(e);
  }
}

main();
