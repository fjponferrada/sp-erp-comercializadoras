const fs = require('fs');
let f1 = 'src/app/(app)/leads/LeadsClient.tsx';
let c1 = fs.readFileSync(f1, 'utf8');

c1 = c1.replace(
  /className="animate-fade-in-up"\s*className="grid grid-cols-2 lg:grid-cols-4 gap-4"/,
  'className="animate-fade-in-up grid grid-cols-2 lg:grid-cols-4 gap-4"'
);

fs.writeFileSync(f1, c1, 'utf8');
console.log('Fixed LeadsClient.tsx duplicate className.');
