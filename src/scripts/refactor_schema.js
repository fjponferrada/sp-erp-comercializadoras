const fs = require('fs');
const path = require('path');

const schemaPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'prisma', 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// For Contract:
// Remove redundant fields that belong to Client or SupplyPoint:
// tipoEntrada, captacionCliente, autoconsumo, gasIncluido, bolsilloSolar -> Wait, bolsilloSolar is boolean and belongs to contract as 'asociarBolsilloSolar'. Let's keep bolsilloSolar.
// Remove: nombreComercial? (Wait, that might be brand or company).
// Wait, the user agreed to remove redundant demographics.
// The Contract model doesn't actually have cups, cnae, etc. directly! Let's check what it has.
// Let's add the missing specific fields to Contract and Lead.

// Add isB2B to Contract
if (!content.includes('isB2B Boolean?')) {
    content = content.replace(
        '  tipo                           String?',
        '  isB2B                          Boolean?\n  tipo                           String?'
    );
}

// Ensure Lead has isB2B
if (!content.includes('isB2B              Boolean?')) {
    content = content.replace(
        '  contactVat              String?',
        '  isB2B                   Boolean?\n  contactVat              String?'
    );
}

// Ensure Contract has filePdfDraft and filePdfSigned
if (!content.includes('filePdfDraft                   String?')) {
    content = content.replace(
        '  diasRenovMax                   Int?',
        '  diasRenovMax                   Int?\n  filePdfDraft                   String?\n  filePdfSigned                  String?\n  isMultipoint                   Boolean?'
    );
}

// Remove redundant demographic fields from Lead
const redundantLeadFields = [
  '  titularStreetType String?',
  '  titularStreet     String?',
  '  titularNumber     String?',
  '  titularFloor      String?',
  '  titularDoor       String?',
  '  titularPostalCode String?',
  '  titularCity       String?',
  '  titularProvince   String?',
  '  supplyStreetType String?',
  '  supplyStreet     String?',
  '  supplyNumber     String?',
  '  supplyFloor      String?',
  '  supplyDoor       String?',
  '  supplyPostalCode String?',
  '  supplyCity       String?',
  '  supplyProvince   String?'
];

redundantLeadFields.forEach(field => {
    content = content.replace(field, `  // REMOVED (Redundant) ${field.trim()}`);
});

fs.writeFileSync(schemaPath, content);
console.log('Schema refactored successfully.');
