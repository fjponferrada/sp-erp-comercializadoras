import * as fs from 'fs';

const filePath = 'src/lib/services/PricingEngine.ts';
let content = fs.readFileSync(filePath, 'utf8');

const findTarget = `      const unitRestricciones = restriccionesArr[i];
      const unitOs = osArr[i];
      const unitDesvios = deviations;
      
      let lossPct = perdPct;`;

const replaceTarget = `      const unitRestricciones = restriccionesArr[i];
      const unitOs = osArr[i];
      const unitDesvios = deviations;
      
      const kFactor = kArr[i] || 1;
      let lossPct = oldPerdArr[i] || 0;
      if (boeRecord) {
        const periodStr = this.getPeriodo(dt, tariff, false);
        const pVal = boeRecord[periodStr.toLowerCase() as keyof typeof boeRecord] as number | null;
        if (pVal !== null && pVal !== undefined) {
          lossPct = pVal * kFactor;
        }
      }`;

content = content.replace(findTarget, replaceTarget);

fs.writeFileSync(filePath, content);
console.log('PricingEngine.ts fixed.');
