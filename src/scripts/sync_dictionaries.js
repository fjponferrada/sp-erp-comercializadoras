const xlsx = require('xlsx');
const path = require('path');

const docsDir = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs');
const leadsPath = path.join(docsDir, 'diccionario_leads.xlsx');
const contratosPath = path.join(docsDir, 'diccionario_contratos.xlsx');

// Helper to determine if a description is a default boilerplate
function isDefaultDesc(desc) {
    if (!desc) return true;
    return desc.includes('Pendiente de definir') || 
           desc.includes('Datos de potencia') || 
           desc.includes('Campo de fecha') || 
           desc.includes('errores internos') || 
           desc.includes('correo electrónico');
}

// 1. Read LEADS dictionary to extract learned meanings
const leadsWorkbook = xlsx.readFile(leadsPath);
const leadsData = xlsx.utils.sheet_to_json(leadsWorkbook.Sheets[leadsWorkbook.SheetNames[0]]);

const learnedMappings = {};
leadsData.forEach(row => {
    const name = row['Nombre Airtable'];
    const desc = row['Descripción / Significado'];
    if (!isDefaultDesc(desc)) {
        learnedMappings[name] = desc;
    }
});

// Add a few custom learned rules based on the user's latest message that might not be EXACT match in name
learnedMappings['TIPO'] = learnedMappings['TIPO'] || 'Código del tipo de tramitación a realizar: C1, C2, A3, M1...';
learnedMappings['TIPO C2'] = learnedMappings['TIPO C2'] || 'Para M1: S (administrativa), N (técnica) o A (ambas)';
learnedMappings['AUTOCONSUMO FIJO / INDEX'] = learnedMappings['AUTOCONSUMO FIJO / INDEX'] || 'Fijo (F) o Indexado (I) para pago de excedentes';
learnedMappings['¿Asociar a Bolsillo Solar?'] = learnedMappings['¿Asociar a Bolsillo Solar?'] || 'Asociar cups a batería virtual del CIF para beneficiarse de excedentes';
learnedMappings['CG BOLSILLO SOLAR'] = learnedMappings['CG BOLSILLO SOLAR'] || 'Coste de gestión por activar bolsillo solar en el cups';

// 2. Read CONTRATOS dictionary
const contratosWorkbook = xlsx.readFile(contratosPath);
const sheetName = contratosWorkbook.SheetNames[0];
const contratosData = xlsx.utils.sheet_to_json(contratosWorkbook.Sheets[sheetName]);

let updatedCount = 0;

const newData = contratosData.map(row => {
    const name = row['Nombre Airtable'];
    const currentDesc = row['Descripción / Significado'];

    if (isDefaultDesc(currentDesc)) {
        // Try exact match
        if (learnedMappings[name]) {
            row['Descripción / Significado'] = learnedMappings[name];
            updatedCount++;
        } else {
            // Try matching common suffixes/prefixes
            const baseName = name.replace(' (from PRODUCTOS)', '').replace(' (from Producto)', '').trim();
            if (learnedMappings[baseName]) {
                row['Descripción / Significado'] = learnedMappings[baseName];
                updatedCount++;
            }
        }
    }
    return row;
});

// 3. Save CONTRATOS dictionary
if (updatedCount > 0) {
    const worksheet = xlsx.utils.json_to_sheet(newData);
    worksheet['!cols'] = [ {wch: 35}, {wch: 80}, {wch: 40} ];
    contratosWorkbook.Sheets[sheetName] = worksheet;
    xlsx.writeFile(contratosWorkbook, contratosPath);
    console.log(`¡Éxito! Se han volcado ${updatedCount} descripciones de LEADS a CONTRATOS.`);
} else {
    console.log(`No se encontraron campos nuevos para sincronizar en CONTRATOS.`);
}
