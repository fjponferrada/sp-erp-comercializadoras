import * as fs from 'fs';

// 1. Update ForecastService.ts
const forecastPath = 'src/lib/services/ForecastService.ts';
let forecastContent = fs.readFileSync(forecastPath, 'utf8');
forecastContent = forecastContent.replace(
  'const sevenDaysAgo = subDays(tomorrow, 7);',
  'const sevenDaysAgo = subDays(tomorrow, 364);'
);
fs.writeFileSync(forecastPath, forecastContent);

// 2. Update page.tsx for precios-componentes
const pagePath = 'src/app/(app)/compras/precios-componentes/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

const oldMap = `  const components = componentRecords.map(r => r.component);
  if (components.length === 0) components.push('OMIE');`;
const newMap = `  let components = componentRecords.map(r => r.component).filter(c => !c.startsWith('PERD_'));
  if (components.length === 0) components.push('OMIE');`;

pageContent = pageContent.replace(oldMap, newMap);
fs.writeFileSync(pagePath, pageContent);

console.log('Both files patched successfully.');
