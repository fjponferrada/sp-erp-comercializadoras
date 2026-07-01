import * as fs from 'fs';

const filePath = 'src/scripts/calculate_pending_energy.ts';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import { getPeriodoREE }')) {
  content = content.replace(
    "import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';",
    "import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';\nimport { getPeriodoREE } from '../lib/services/InternalBillingEngine';"
  );
  fs.writeFileSync(filePath, content);
  console.log('calculate_pending_energy.ts missing import added.');
} else {
  console.log('calculate_pending_energy.ts already has import.');
}
