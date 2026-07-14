const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});

async function run() {
  await client.connect();
  console.log("Detecting F1 invoices with incorrect contracts across the ENTIRE system (F1Invoice table)...");
  
  const f1Res = await client.query(`
    SELECT f1.id, f1."supplyPointId", f1."contractId", f1."fechaInicio", f1."fechaFin", s.cups 
    FROM "F1Invoice" f1
    JOIN "SupplyPoint" s ON f1."supplyPointId" = s.id 
  `);
  
  let mismatchCount = 0;
  
  for (const f1 of f1Res.rows) {
    if (!f1.supplyPointId) continue;
    
    const cRes = await client.query('SELECT id, status, "activationDate", "terminationDate" FROM "Contract" WHERE "supplyPointId" = $1', [f1.supplyPointId]);
    const contracts = cRes.rows;
    if (contracts.length === 0) continue;
    
    const overlappingContracts = contracts.filter(c => {
      if (c.status === 'DRAFT' || c.status === 'Borrador') return false;
      if (!c.activationDate) return false;
      
      const fileFechaFin = f1.fechaFin ? new Date(f1.fechaFin) : new Date();
      const fileFechaInicio = f1.fechaInicio ? new Date(f1.fechaInicio) : new Date();
      
      const startOverlap = new Date(c.activationDate) <= fileFechaFin;
      const endOverlap = !c.terminationDate || new Date(c.terminationDate) >= fileFechaInicio;
      
      return startOverlap && endOverlap;
    });
    
    overlappingContracts.sort((a, b) => new Date(a.activationDate).getTime() - new Date(b.activationDate).getTime());
    const applicableContract = overlappingContracts[0];
    
    let expectedContractId = null;
    if (applicableContract) {
      expectedContractId = applicableContract.id;
    } else {
      const activeFallback = contracts.find(c => c.status !== 'DRAFT' && c.status !== 'Borrador');
      if (activeFallback) expectedContractId = activeFallback.id;
    }
    
    if (expectedContractId && expectedContractId !== f1.contractId) {
      mismatchCount++;
    }
  }
  
  console.log(`\nTotal mismatched F1Invoice rows found in the whole system: ${mismatchCount}`);
  await client.end();
}

run().catch(console.error);
