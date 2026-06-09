const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const docsDir = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs');
const dictPath = path.join(docsDir, 'diccionario_facturas.xlsx');
const schemaPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'prisma', 'schema.prisma');

const workbook = xlsx.readFile(dictPath);
const data = xlsx.utils.sheet_to_json(workbook.Sheets['Diccionario']);
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Get the Invoice block
const invoiceBlockMatch = schemaContent.match(/model Invoice \{([\s\S]*?)\}/);
const invoiceBlock = invoiceBlockMatch ? invoiceBlockMatch[1] : '';

// Helper to check if a string is a known relation (we don't import these as text)
const isRelation = (name) => {
    return name === 'CONTRATO' || name === 'CUPS' || name === 'LEADS' || name === 'CLIENTES' || name.includes('(from');
};

const missingFields = [];

data.forEach(row => {
    const name = row['Nombre Airtable'];
    const desc = row['Descripción / Significado'];
    let pg = row['Campo Equivalente PostgreSQL'];
    
    // Si el usuario no lo ha definido o si es genérico pero no es relacion
    if (!isRelation(name)) {
        // Let's create a camelCase property name
        let propName = name.replace(/[^a-zA-Z0-9]/g, ' ').trim().replace(/\s+(.)/g, (match, group1) => group1.toUpperCase()).replace(/\s/g, '');
        propName = propName.charAt(0).toLowerCase() + propName.slice(1);
        
        // Let's see if this exact name exists in the schema or if it's already mapped
        let mappedProp = pg ? pg.replace('invoice.', '').trim() : '';
        if (mappedProp.includes('No mapeado') || mappedProp.includes('Por determinar')) {
            mappedProp = '';
        }
        
        if (mappedProp) {
            // Check if mappedProp is in schema
            if (!invoiceBlock.includes(`  ${mappedProp} `)) {
                missingFields.push({ name, propName: mappedProp, desc });
            }
        } else {
            // Unmapped, check if propName exists
            if (!invoiceBlock.includes(`  ${propName} `)) {
                missingFields.push({ name, propName, desc });
            }
        }
    }
});

console.log(`Missing fields to add to Invoice: ${missingFields.length}`);
fs.writeFileSync('C:\\Users\\Administrator\\sp-erp-comercializadoras\\src\\scripts\\missing_invoice_fields.json', JSON.stringify(missingFields, null, 2));
