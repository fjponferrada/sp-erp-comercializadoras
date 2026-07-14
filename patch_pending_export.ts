import * as fs from 'fs';

const filePath = 'src/scripts/calculate_pending_energy.ts';
let content = fs.readFileSync(filePath, 'utf8');

// replace async function main() with export async function runCalculatePendingEnergy()
content = content.replace(/async function main\(\) \{/, 'export async function runCalculatePendingEnergy() {');

// remove the main().catch(...).finally(...) at the end
const endRegex = /main\(\)\s*\.catch\(\(e\) => \{[\s\S]*\}\)\s*\.finally\(async \(\) => \{[\s\S]*\}\);/;
content = content.replace(endRegex, `
if (require.main === module) {
  runCalculatePendingEnergy()
    .catch((e) => {
      console.error('Error calculando:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
`);

fs.writeFileSync(filePath, content);
console.log('calculate_pending_energy.ts updated to export function.');
