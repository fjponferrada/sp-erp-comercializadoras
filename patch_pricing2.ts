import * as fs from 'fs';

const filePath = 'src/lib/services/PricingEngine.ts';
let content = fs.readFileSync(filePath, 'utf8');

const findTarget1 = "const boeRecord = regulatedCosts.find(c => c.concept === 'PERDIDAS' && c.tariff === tariff);";
const replaceTarget1 = "const boeRecord = regulated.find(c => c.concept === 'PERDIDAS' && c.tariff === tariff);";

content = content.replace(findTarget1, replaceTarget1);

fs.writeFileSync(filePath, content);
console.log('PricingEngine.ts patched again.');
