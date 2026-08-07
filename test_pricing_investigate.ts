import { PricingEngine } from './src/lib/services/PricingEngine';

async function investigate() {
  const quote = await PricingEngine.generateQuote({
    tariff: '2.0TD',
    margin: 0,
    deviations: 2.0,
    annualConsumptionKwh: 10000,
    startDate: '2026-08-06',
    durationMonths: 12,
    riskLevel: 2
  });

  const avgBase = { P1: {sum:0, count:0}, P2: {sum:0, count:0}, P3: {sum:0, count:0} };
  
  for(const h of quote.hourlyDetails) {
     if(avgBase[h.per]) {
        avgBase[h.per].sum += h.baseMercadoEur;
        avgBase[h.per].count++;
     }
  }

  console.log('Avg Base Mercado (OMIE) by period:');
  console.log('P1:', avgBase.P1.sum / avgBase.P1.count);
  console.log('P2:', avgBase.P2.sum / avgBase.P2.count);
  console.log('P3:', avgBase.P3.sum / avgBase.P3.count);
  
  console.log('\nPeriods Result from Quote:');
  console.log(quote.periods);
}

investigate().catch(console.error);
