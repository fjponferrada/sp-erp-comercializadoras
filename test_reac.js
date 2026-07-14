const { prisma } = require('./src/lib/prisma');

async function run() {
  const f1s = await prisma.f1Invoice.findMany({
    where: { supplyPoint: { cups: { contains: 'ES0031102722873001YA0F' } } },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  
  if (f1s.length > 0) {
    const f1 = f1s[0];
    console.log("Found F1:", f1.id);
    const json = typeof f1.jsonData === 'string' ? JSON.parse(f1.jsonData) : f1.jsonData;
    console.log("Keys in JSON:", Object.keys(json || {}));
    console.log("EnergiaReactiva:", JSON.stringify(json?.EnergiaReactiva || json?.['Energia Reactiva'] || json?.['EnergiaReactiva'] || null, null, 2));
    
    // find keys containing reactiva
    const keys = Object.keys(json || {});
    const reacKeys = keys.filter(k => k.toLowerCase().includes('reactiva') || k.toLowerCase().includes('ratr'));
    console.log("Keys with reactiva:", reacKeys);
    for (const rk of reacKeys) {
        console.log(`Value of ${rk}:`, JSON.stringify(json[rk]));
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
