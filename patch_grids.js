const fs = require('fs');

// 1. LeadsClient.tsx
let f1 = 'src/app/(app)/leads/LeadsClient.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace(
  /style=\{\{\s*display:\s*'grid',\s*gridTemplateColumns:\s*'repeat\(4,1fr\)',\s*gap:\s*'16px'\s*\}\}/,
  'className="grid grid-cols-2 lg:grid-cols-4 gap-4"'
);
fs.writeFileSync(f1, c1, 'utf8');

// 2. ContractsClient.tsx
let f2 = 'src/app/(app)/contratos/ContractsClient.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(
  /className="animate-fade-in-up grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8"/,
  'className="animate-fade-in-up grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8"'
);
fs.writeFileSync(f2, c2, 'utf8');

// 3. ClientesClient.tsx
let f3 = 'src/app/(app)/clientes/ClientesClient.tsx';
let c3 = fs.readFileSync(f3, 'utf8');
c3 = c3.replace(
  /style=\{\{\s*display:\s*'grid',\s*gridTemplateColumns:\s*'repeat\(3,\s*1fr\)',\s*gap:\s*16\s*\}\}/,
  'className="grid grid-cols-1 md:grid-cols-3 gap-4"'
);
fs.writeFileSync(f3, c3, 'utf8');

// 4. Topbar.tsx
let f4 = 'src/components/Topbar.tsx';
let c4 = fs.readFileSync(f4, 'utf8');
c4 = c4.replace(
  /<p style=\{\{ fontSize: '0.72rem', color: 'var\(--text-muted\)', margin: 0, marginTop: '2px' \}\}>/,
  '<p className="hidden md:block" style={{ fontSize: \'0.72rem\', color: \'var(--text-muted)\', margin: 0, marginTop: \'2px\' }}>'
);
fs.writeFileSync(f4, c4, 'utf8');

console.log('Mobile layout tweaks applied successfully.');
