const fs = require('fs');

// Fix BajasClient.tsx
let f1 = 'src/app/(app)/bajas/BajasClient.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
if (!c1.includes("Mail }")) {
  c1 = c1.replace(/import {([^}]+)} from 'lucide-react';/, "import {$1, Mail} from 'lucide-react';");
  fs.writeFileSync(f1, c1, 'utf8');
}

// Fix RenovacionesClient.tsx
let f2 = 'src/app/(app)/renovaciones/RenovacionesClient.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(/\{r\.comercial\}/g, "{r.emailComercial?.split('@')[0]}");
c2 = c2.replace(/r\.fechaFin/g, "r.vencimiento");

if (!c2.includes("ExternalLink }")) {
  c2 = c2.replace(/import {([^}]+)} from 'lucide-react';/, "import {$1, ExternalLink} from 'lucide-react';");
}
fs.writeFileSync(f2, c2, 'utf8');

console.log('Fixed typings.');
