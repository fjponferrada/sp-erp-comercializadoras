const fs = require('fs');

const FILE_PATH = 'src/app/(app)/contratos/[id]/ContractDetailClient.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// Ensure import exists
if (!content.includes('import { formatDateUTC }')) {
    content = content.replace("import { useState } from 'react';", "import { useState } from 'react';\nimport { formatDateUTC } from '@/lib/utils/date';");
}

// Global replacement: replace `new Date(SOMETHING).toLocaleDateString('es-ES')` with `formatDateUTC(SOMETHING)`
// The regex finds new Date( group ).toLocaleDateString('es-ES') and handles nested parentheses by simply taking the longest match within limits, or we can just replace specifically.
// Given JavaScript regex limitations, it might be safer to replace known patterns.

content = content.replace(/new Date\(([^)]+)\)\.toLocaleDateString\('es-ES'\)/g, "formatDateUTC($1)");

fs.writeFileSync(FILE_PATH, content);
console.log('Successfully patched dates in ContractDetailClient.tsx');
