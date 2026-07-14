import * as fs from 'fs';

const filePath = 'src/lib/services/PricingEngine.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix getHours -> getUTCHours
content = content.replace(
  "const h1 = dt1.getHours();",
  "const h1 = dt1.getUTCHours();"
);
content = content.replace(
  "const h2 = dt2.getHours();",
  "const h2 = dt2.getUTCHours();"
);

// 2. Fix default K value
const oldDefault = `    if (validVals.length === 0) {
      return compName === 'RESTRICCIONES' ? 5.0 : (compName === 'OS' ? 2.0 : 0.18);
    }`;
const newDefault = `    if (validVals.length === 0) {
      if (compName === 'RESTRICCIONES') return 5.0;
      if (compName === 'OS') return 2.0;
      if (compName === 'K') return 1.0;
      return 0.18;
    }`;
content = content.replace(oldDefault, newDefault);

// 3. Remove oldPerdArr
const oldPerdCode = `    // Fetch old PERD as fallback
    let lossCol = 'PERD_30TD';
    if (tariff.includes('2.0')) lossCol = 'PERD_20TD';
    if (tariff.includes('6.1')) lossCol = 'PERD_61TD';
    const oldPerdArr = await smartMergeDB(dates, lossCol, riskLevel);`;
content = content.replace(oldPerdCode, "");

const oldLossCalc = `      const kFactor = kArr[i] || 1;
      let lossPct = oldPerdArr[i] || 0;
      if (boeRecord) {
        const periodStr = this.getPeriodo(dt, tariff, false);
        const pVal = boeRecord[periodStr.toLowerCase() as keyof typeof boeRecord] as number | null;
        if (pVal !== null && pVal !== undefined) {
          lossPct = pVal * kFactor;
        }
      }`;
const newLossCalc = `      const kFactor = kArr[i] || 1;
      let lossPct = 0;
      if (boeRecord) {
        const periodStr = this.getPeriodo(dt, tariff, false);
        const pVal = boeRecord[periodStr.toLowerCase() as keyof typeof boeRecord] as number | null;
        if (pVal !== null && pVal !== undefined) {
          lossPct = pVal * kFactor;
        }
      }`;
content = content.replace(oldLossCalc, newLossCalc);

fs.writeFileSync(filePath, content);
console.log('PricingEngine.ts patched successfully.');
