const fs = require('fs');
const xlsx = require('xlsx');

const results = JSON.parse(fs.readFileSync('audit_results.json', 'utf8'));

// Filter out garbage
function isGarbage(f) {
    if (f.toLowerCase().includes('copy')) return true;
    if (f.toLowerCase().includes('email') && !f.toLowerCase().includes('factura')) return true; // Keep EMAIL FACTURA maybe?
    if (f.toLowerCase().includes('pdf') || f.toLowerCase().includes('.xml')) return true; // Handled by Document
    if (f.toLowerCase().includes('link')) return true; // Handled natively or ignored
    if (f.startsWith('From field:')) return true;
    if (f.toLowerCase().includes('comercial') && !f.toLowerCase().includes('código')) return true; // Emails and such
    return false;
}

const typeMap = {
    'SIPS OK': 'Boolean?',
    'Demanda': 'Float?',
    'Excedentes': 'Float?',
    'COMISION': 'Float?',
    'Fecha': 'DateTime?',
    'Día': 'Int?',
    'Mes': 'String?',
    'Año': 'Int?',
    'P1': 'Float?', 'P2': 'Float?', 'P3': 'Float?', 'P4': 'Float?', 'P5': 'Float?', 'P6': 'Float?',
    'Importe': 'Float?',
    'Base Imponible': 'Float?'
};

function guessType(f) {
    for (const [key, val] of Object.entries(typeMap)) {
        if (f.includes(key)) return val;
    }
    return 'String?'; // Default
}

function cleanName(f) {
    let n = f.replace(/[^a-zA-Z0-9]/g, '');
    n = n.charAt(0).toLowerCase() + n.slice(1);
    if (!isNaN(n.charAt(0))) n = 'n' + n;
    return n;
}

const schemaAdditions = {};
const newMappings = {};

for (const model in results) {
    schemaAdditions[model] = [];
    newMappings[model] = [];

    for (const f of results[model]) {
        if (!isGarbage(f)) {
            const fieldName = cleanName(f);
            const fieldType = guessType(f);
            schemaAdditions[model].push(`  ${fieldName} ${fieldType}`);
            
            newMappings[model].push({
                'Nombre Airtable': f,
                'Campo Equivalente PostgreSQL': `${model.charAt(0).toLowerCase() + model.slice(1)}.${fieldName}`
            });
        }
    }
}

// Print schema additions
for (const model in schemaAdditions) {
    console.log(`\n// --- NEW FIELDS FOR ${model} ---`);
    console.log(schemaAdditions[model].join('\n'));
}

// Update Excel files
const dictFiles = {
    'Contract': 'docs/diccionario_contratos.xlsx',
    'Lead': 'docs/diccionario_leads.xlsx',
    'Invoice': 'docs/diccionario_facturas.xlsx',
    'SupplyPoint': 'docs/diccionario_instalaciones.xlsx',
    'Product': 'docs/diccionario_productos.xlsx'
};

for (const model in newMappings) {
    const file = dictFiles[model];
    if (!file || !fs.existsSync(file)) continue;

    const wb = xlsx.readFile(file);
    const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    
    for (const mapping of newMappings[model]) {
        const existing = data.find(d => d['Nombre Airtable'] === mapping['Nombre Airtable']);
        if (existing) {
            existing['Campo Equivalente PostgreSQL'] = mapping['Campo Equivalente PostgreSQL'];
        } else {
            data.push(mapping);
        }
    }

    const newSheet = xlsx.utils.json_to_sheet(data);
    wb.Sheets[wb.SheetNames[0]] = newSheet;
    xlsx.writeFile(wb, file);
    console.log(`Updated ${file} with ${newMappings[model].length} fields.`);
}
