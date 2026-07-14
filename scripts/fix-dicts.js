const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

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

const isFieldValid = (str) => {
    if (!str || str.toLowerCase().includes('ignorar') || str.toLowerCase() === 'no' || str === '-' || str.includes('airtableData')) return true;
    const parts = str.split(/[\/,]/).map(p => p.trim().toLowerCase());
    let allValid = true;
    for (let part of parts) {
        if (!part || part.includes('(') || part === 'json' || part === 'airtabledata' || part === 'n/a') continue;
        if (!validFields.has(part)) {
            allValid = false;
        }
    }
    return allValid;
};

const docsPath = path.join(__dirname, '../docs');
const files = fs.readdirSync(docsPath).filter(f => f.endsWith('.xlsx'));

files.forEach(file => {
  const wb = xlsx.readFile(path.join(docsPath, file));
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  let entity = 'lead';
  if (file.includes('contrato')) entity = 'contract';
  if (file.includes('factura')) entity = 'invoice';
  if (file.includes('cliente')) entity = 'client';
  if (file.includes('producto')) entity = 'product';

  let modified = false;

  const newData = data.map(row => {
    const atColKey = Object.keys(row).find(k => k.toLowerCase().includes('airtable') || k.toLowerCase().includes('campo'));
    const pgColKey = Object.keys(row).find(k => k.toLowerCase().includes('postgre'));
    
    if (!atColKey || !pgColKey) return row;
    
    const atName = row[atColKey];
    let pgCol = row[pgColKey];
    
    // Hardcoded fixes
    if (atName === 'CNAE') pgCol = 'supplyPoint.cnae';
    else if (atName === 'IBAN' || atName === 'Certificado IBAN') pgCol = 'client.iban';
    else if (atName === 'Tipo de persona') pgCol = 'client.clientType';
    else if (atName && atName.match(/^P[1-6]C W$/)) pgCol = 'Ignorado (Fórmula)';
    else if (atName === 'P1C') pgCol = 'supplyPoint.p1c';
    else if (atName === 'P2C') pgCol = 'supplyPoint.p2c';
    else if (atName === 'P3C') pgCol = 'supplyPoint.p3c';
    else if (atName === 'P4C') pgCol = 'supplyPoint.p4c';
    else if (atName === 'P5C') pgCol = 'supplyPoint.p5c';
    else if (atName === 'P6C') pgCol = 'supplyPoint.p6c';
    else if (atName === 'CONSUMO ANUAL KWH') pgCol = 'lead.estimatedMWh';
    else if (atName === 'Email Comercial') pgCol = 'No migrar (roles)';
    else if (pgCol && !isFieldValid(pgCol)) {
        pgCol = `${entity}.airtableData (JSON)`;
    }

    if (row[pgColKey] !== pgCol) {
        row[pgColKey] = pgCol;
        modified = true;
    }
    return row;
  });

  if (modified) {
    const newSheet = xlsx.utils.json_to_sheet(newData);
    wb.Sheets[sheetName] = newSheet;
    xlsx.writeFile(wb, path.join(docsPath, file));
    console.log(`Updated ${file}`);
  }
});
