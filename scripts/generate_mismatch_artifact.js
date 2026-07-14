const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});

async function run() {
  await client.connect();
  
  const f1Res = await client.query(`
    SELECT f1.id, f1."numeroFactura", f1."supplyPointId", f1."contractId", f1."fechaInicio", f1."fechaFin", s.cups 
    FROM "F1Invoice" f1
    JOIN "SupplyPoint" s ON f1."supplyPointId" = s.id 
  `);
  
  let mdContent = `# F1 Invoices con Contratos Erróneos\n\n`;
  mdContent += `A continuación se muestran los archivos F1 que tienen un contrato asignado en la base de datos diferente al que deberían tener según la lógica actual.\n\n`;
  mdContent += `| CUPS | Factura | F. Inicio | F. Fin | Contrato Actual | Contrato Esperado |\n`;
  mdContent += `|------|---------|-----------|--------|-----------------|-------------------|\n`;
  
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
      const fInicio = f1.fechaInicio ? f1.fechaInicio.toISOString().substring(0,10) : 'N/A';
      const fFin = f1.fechaFin ? f1.fechaFin.toISOString().substring(0,10) : 'N/A';
      
      mdContent += `| ${f1.cups} | ${f1.numeroFactura || 'SIN_COD'} | ${fInicio} | ${fFin} | ${f1.contractId} | ${expectedContractId} |\n`;
    }
  }
  
  mdContent += `\n**Total detectados:** ${mismatchCount}\n`;
  
  fs.writeFileSync('C:/Users/Administrator/.gemini/antigravity/brain/5625170d-673a-471a-b1f3-7e5874175dbc/mismatched_f1_invoices.md', mdContent);
  console.log(`Artifact created with ${mismatchCount} mismatches.`);
  
  await client.end();
}

run().catch(console.error);
