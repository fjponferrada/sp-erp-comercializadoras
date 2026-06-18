const fs = require('fs');

let code = fs.readFileSync('src/app/actions/analysisActions.ts', 'utf8');

code = code.replace(/const results: any\[\] = await prisma\.\$queryRaw\\`([\s\S]*?)\\`;/, 
  'const results: any[] = await prisma.$queryRaw`$1`;'
);

code = code.replace(/\\\$\{Prisma\.join\(chunk\)\}/g, '${Prisma.join(chunk)}');

fs.writeFileSync('src/app/actions/analysisActions.ts', code);
console.log('Fixed syntax in analysisActions.ts');
