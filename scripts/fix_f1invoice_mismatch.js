const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});

async function run() {
  await client.connect();
  console.log("Fixing F1Invoice contractId...");
  
  const f1Res = await client.query(`
    SELECT f1.id, f1."supplyPointId", f1."contractId", f1."fechaInicio", f1."fechaFin", s.cups 
    FROM "F1Invoice" f1
    JOIN "SupplyPoint" s ON f1."supplyPointId" = s.id 
    WHERE s.cups ILIKE '%ES0031103465436006RG0F%'
  `);
  
  let fixCount = 0;
  
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
      console.log(`\nCorrigiendo F1Invoice para CUPS: ${f1.cups}`);
      console.log(`Cambiando contrato de ${f1.contractId} a ${expectedContractId}...`);
      
      await client.query('UPDATE "F1Invoice" SET "contractId" = $1 WHERE id = $2', [expectedContractId, f1.id]);
      fixCount++;
      console.log('¡Corregido exitosamente!');
    }
  }
  
  console.log(`\nTotal de F1Invoice corregidos: ${fixCount}`);
  await client.end();
}

run().catch(console.error);
