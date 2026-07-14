const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// 1. Parse schema.prisma to get valid model.field
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
const validFields = new Set();
let currentModel = null;

schemaContent.split('\n').forEach(line => {
    const modelMatch = line.match(/^model\s+(\w+)/);
    if (modelMatch) {
        currentModel = modelMatch[1].toLowerCase();
        return;
    }
    if (currentModel && line.match(/^\s+(\w+)\s+\w+/)) {
        const fieldMatch = line.match(/^\s+(\w+)\s+\w+/);
        if (fieldMatch) {
            validFields.add(`${currentModel}.${fieldMatch[1].toLowerCase()}`);
        }
    }
    if (line.includes('}')) {
        currentModel = null;
    }
});

// Also add variants like "ignored", "no_import", "relational", etc.
const isFieldValid = (str) => {
    if (!str || str.toLowerCase().includes('ignorar') || str.toLowerCase() === 'no' || str === '-') return true;
    
    // Split by / or , to handle multiple like "client.iban / lead.iban"
    const parts = str.split(/[\/,]/).map(p => p.trim().toLowerCase());
    let allValid = true;
    for (let part of parts) {
        if (!part) continue;
        if (part.includes('(')) continue; // e.g. json(airtableData)
        if (part === 'json') continue;
        if (part === 'airtabledata') continue;
        if (part === 'n/a') continue;
        if (!validFields.has(part)) {
            // Check if it's a known relation or just a case issue
            // We just flag it
            allValid = false;
        }
    }
    return allValid;
};

// 2. Check xlsx files
const docsPath = path.join(__dirname, '../docs');
const files = fs.readdirSync(docsPath).filter(f => f.endsWith('.xlsx'));

files.forEach(file => {
  const wb = xlsx.readFile(path.join(docsPath, file));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  let hasErrors = false;
  console.log(`\n=== ${file} ===`);
  data.forEach(row => {
    const colName = row['Airtable Column'] || row['Columna Airtable'] || row['Campo Airtable'] || row['Campo'] || row['Nombre Airtable'];
    const pgCol = row['PostgreSQL Column'] || row['Campo Equivalente PostgreSQL'] || row['Campo PostgreSQL'];
    
    if (pgCol && !isFieldValid(pgCol)) {
      console.log(`- Airtable: "${colName}" | mapped to: "${pgCol}" (INVALID)`);
      hasErrors = true;
    }
  });
  if (!hasErrors) console.log("All mappings seem valid.");
});
