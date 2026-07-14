const fs = require('fs');
let f = 'src/app/(app)/contratos/[id]/ContractDetailClient.tsx';
let c = fs.readFileSync(f, 'utf8');

// For Switching
c = c.replace(/(\) : \(\s*)(\{\/\* Mobile View Switching \*\/})/g, '$1<>\n$2');
c = c.replace(/(\s*<\/table>\s*<\/div>\s*)(\)\}\s*<\/div>\s*\}\s*\{\s*activeTab === 'Reclamaciones')/g, '$1</>\n$2');

// For F1s
c = c.replace(/(\) : \(\s*)(\{\/\* Mobile View F1s \*\/})/g, '$1<>\n$2');
c = c.replace(/(\s*<\/table>\s*<\/div>\s*)(\)\}\s*<\/div>\s*\}\s*\{\s*\['Consumos'\])/g, '$1</>\n$2');

fs.writeFileSync(f, c, 'utf8');
console.log('ContractDetailClient fragments patched.');
