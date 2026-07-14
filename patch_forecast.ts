import * as fs from 'fs';

const filePath = 'src/lib/services/ForecastService.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add getPeriodoREE import
if (!content.includes('getPeriodoREE')) {
  content = content.replace(
    "import { DecisionTreeRegression } from 'ml-cart';",
    "import { DecisionTreeRegression } from 'ml-cart';\nimport { getPeriodoREE } from './InternalBillingEngine';"
  );
}

// 2. Modify currentClients grouping
// find:
/*
    // Elevación a barras de central (Pérdidas)
    const tariff = c.supplyPoint.tariff || '';
    const lossFactor = tariff.includes('6.1TD') ? 1.08 : 1.17;

    const prov = getProvinceGeo(c.supplyPoint.postalCode).name;
    const key = `${segment}|${prov}`;
    currentClients[key] = (currentClients[key] || 0) + lossFactor;
*/
const oldGrouping = `    // Elevación a barras de central (Pérdidas)
    const tariff = c.supplyPoint.tariff || '';
    const lossFactor = tariff.includes('6.1TD') ? 1.08 : 1.17;

    const prov = getProvinceGeo(c.supplyPoint.postalCode).name;
    const key = \`\${segment}|\${prov}\`;
    currentClients[key] = (currentClients[key] || 0) + lossFactor;`;

const newGrouping = `    const tariff = c.supplyPoint.tariff || '2.0TD';
    const prov = getProvinceGeo(c.supplyPoint.postalCode).name;
    const key = \`\${segment}|\${prov}|\${tariff}\`;
    currentClients[key] = (currentClients[key] || 0) + 1;`;

content = content.replace(oldGrouping, newGrouping);

// 3. Fetch BOE coefficients and K values before ML load
const fetchBoeRegex = /  \/\/ 1\. Load Pre-trained AI Model from Database/;
const fetchBoeCode = `
  // 1A. Obtener coeficientes de Pérdidas (BOE y K)
  const regulatedCosts = await prisma.regulatedCost.findMany({
    where: { concept: 'PERDIDAS' }
  });

  const sevenDaysAgo = subDays(tomorrow, 7);
  const kRecords = await prisma.systemComponentPrice.findMany({
    where: { component: 'K', date: startOfDay(sevenDaysAgo) }
  });
  const kArray = kRecords.length > 0 && kRecords[0].values ? (kRecords[0].values as number[]) : new Array(24).fill(1);

  // 1. Load Pre-trained AI Model from Database`;
content = content.replace(fetchBoeRegex, fetchBoeCode);

// 4. Modify VIP / VE calculations
const oldVipFactor = `        const tariff = c.supplyPoint?.tariff || '';
        const lossFactor = tariff.includes('6.1TD') ? 1.08 : 1.17;`;
const newVipFactor = `        const tariff = c.supplyPoint?.tariff || '';
        const boeRec = regulatedCosts.find(r => r.tariff === tariff);`;
content = content.replace(oldVipFactor, newVipFactor);

const oldVipLoop = `            const avgHour = sum / similarDays.length;
            const finalVal = avgHour * lossFactor;
            vipPredictions[h] += finalVal;`;
const newVipLoop = `            const avgHour = sum / similarDays.length;
            
            let lossPct = 0;
            if (boeRec) {
              const dtH = new Date(tomorrow);
              dtH.setUTCHours(h);
              const pStr = getPeriodoREE(dtH, tariff);
              const boeVal = (boeRec as any)[pStr.toLowerCase()] as number | null;
              if (boeVal !== null && boeVal !== undefined) {
                lossPct = boeVal * kArray[h];
              }
            }
            if (lossPct > 2.0) lossPct /= 100.0; // Security check
            const finalVal = avgHour * (1 + lossPct);
            
            vipPredictions[h] += finalVal;`;
content = content.replace(oldVipLoop, newVipLoop);

// 5. Modify ML calculations
const oldML1 = `    for (const [key, activeCount] of Object.entries(currentClients)) {
      if (activeCount === 0) continue; 
      
      const [segment, province] = key.split('|');`;
const newML1 = `    for (const [key, activeCount] of Object.entries(currentClients)) {
      if (activeCount === 0) continue; 
      
      const [segment, province, tariff] = key.split('|');
      const boeRec = regulatedCosts.find(r => r.tariff === tariff);`;
content = content.replace(oldML1, newML1);

const oldML2 = `      for (let h = 0; h < 24; h++) {
        const clusterPrediction = Math.max(0, Y_pred[h]) * activeCount;
        finalPrediction[h] += clusterPrediction;
        if (segmentBreakdown[segment]) segmentBreakdown[segment][h] += clusterPrediction;
      }`;
const newML2 = `      for (let h = 0; h < 24; h++) {
        let lossPct = 0;
        if (boeRec) {
          const dtH = new Date(tomorrow);
          dtH.setUTCHours(h);
          const pStr = getPeriodoREE(dtH, tariff);
          const boeVal = (boeRec as any)[pStr.toLowerCase()] as number | null;
          if (boeVal !== null && boeVal !== undefined) {
            lossPct = boeVal * kArray[h];
          }
        }
        if (lossPct > 2.0) lossPct /= 100.0;
        
        const clusterPrediction = Math.max(0, Y_pred[h]) * activeCount * (1 + lossPct);
        finalPrediction[h] += clusterPrediction;
        if (segmentBreakdown[segment]) segmentBreakdown[segment][h] += clusterPrediction;
      }`;
content = content.replace(oldML2, newML2);

fs.writeFileSync(filePath, content);
console.log('ForecastService.ts patched.');
