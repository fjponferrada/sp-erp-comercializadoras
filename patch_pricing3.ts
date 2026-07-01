import * as fs from 'fs';

const filePath = 'src/lib/services/PricingEngine.ts';
let content = fs.readFileSync(filePath, 'utf8');

const findTarget = `      const unitDesvios = deviations;
      
      let lossPct = perdArr[i];`;

const replaceTarget = `      const unitDesvios = deviations;
      
      let lossPct = perdPct;`;

content = content.replace(findTarget, replaceTarget);

fs.writeFileSync(filePath, content);
console.log('PricingEngine.ts patched to fix perdArr.');
