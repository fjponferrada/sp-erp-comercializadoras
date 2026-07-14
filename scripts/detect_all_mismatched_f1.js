const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});

async function run() {
  await client.connect();
  console.log("Detecting F1 invoices with incorrect contracts across the ENTIRE system...");
  
  const f1Res = await client.query(`
    SELECT i.id, i.status, i."supplyPointId", i."contractId", i."billingStart", i."billingEnd", s.cups 
    FROM "InternalInvoice" i 
    JOIN "SupplyPoint" s ON i."supplyPointId" = s.id 
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
      
      const fileFechaFin = f1.billingEnd ? new Date(f1.billingEnd) : new Date();
      const fileFechaInicio = f1.billingStart ? new Date(f1.billingStart) : new Date();
      
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
      console.log(`\nCUPS: ${f1.cups}`);
      console.log(`InternalInvoice ID: ${f1.id} (Status: ${f1.status})`);
      console.log(`Invoice Dates: ${f1.billingStart?.toISOString().substring(0,10)} to ${f1.billingEnd?.toISOString().substring(0,10)}`);
      
      const currentC = contracts.find(c => c.id === f1.contractId);
      console.log(`CURRENT DB Contract: ${f1.contractId} (Activation: ${currentC?.activationDate?.toISOString().substring(0,10)})`);
      
      const expectedC = contracts.find(c => c.id === expectedContractId);
      console.log(`EXPECTED Contract: ${expectedContractId} (Activation: ${expectedC?.activationDate?.toISOString().substring(0,10)})`);
    }
  }
  
  console.log(`\nTotal mismatched invoices found in the whole system: ${mismatchCount}`);
  await client.end();
}

run().catch(console.error);
