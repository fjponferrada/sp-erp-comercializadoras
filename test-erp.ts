require('dotenv').config({ path: 'C:/Users/Administrator/sp-erp-comercializadoras/.env' });
const { PricingEngine } = require('./src/lib/services/PricingEngine');

async function testERP() {
  console.log('Testing ERP Pricing Engine...');
  const params = {
    tariff: '2.0TD',
    startDate: '2026-08-29',
    durationMonths: 12,
    riskLevel: 2,
    annualConsumptionKwh: 10000,
    margin: 10,
    deviations: 3.5
  };
  
  const quote = await PricingEngine.generateQuote(params);
  
  console.log('ERP Flat Price:', quote.flatPriceEurMwh);
  console.log('ERP Breakdown:', quote.breakdown);
}

testERP().catch(console.error);
