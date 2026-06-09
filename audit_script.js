const fs = require('fs');
const xlsx = require('xlsx');

const dictionaries = [
    { file: 'docs/diccionario_contratos.xlsx', airtable: 'C:/Users/Administrator/tmp_backup/airtable-contratos.txt', model: 'Contract', relatedModels: ['SupplyPoint', 'Client'] },
    { file: 'docs/diccionario_leads.xlsx', airtable: 'C:/Users/Administrator/tmp_backup/airtable-leads.txt', model: 'Lead', relatedModels: ['Client'] },
    { file: 'docs/diccionario_facturas.xlsx', airtable: 'C:/Users/Administrator/tmp_backup/airtable-facturas.txt', model: 'Invoice', relatedModels: [] },
    { file: 'docs/diccionario_instalaciones.xlsx', airtable: 'C:/Users/Administrator/tmp_backup/airtable-instalaciones.txt', model: 'SupplyPoint', relatedModels: [] },
    { file: 'docs/diccionario_productos.xlsx', airtable: 'C:/Users/Administrator/tmp_backup/airtable-productos.txt', model: 'Product', relatedModels: [] },
    { file: 'docs/diccionario_canales.xlsx', airtable: 'C:/Users/Administrator/tmp_backup/airtable-canales.txt', model: 'Channel', relatedModels: [] }
];

const results = {};

for (const dict of dictionaries) {
    if (!fs.existsSync(dict.file)) {
        console.log(`Skipping ${dict.file}, not found.`);
        continue;
    }
    const wb = xlsx.readFile(dict.file);
    const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    
    const mappedFields = new Set();
    const unmappedInDict = [];

    data.forEach(row => {
        const name = row['Nombre Airtable'];
        const mappedTo = row['Campo Equivalente PostgreSQL'];
        if (name) {
            if (!mappedTo || mappedTo.includes('No mapeado') || mappedTo.includes('Ignorado')) {
                unmappedInDict.push(name);
            } else {
                mappedFields.add(name);
            }
        }
    });

    let airtableFields = [];
    if (fs.existsSync(dict.airtable)) {
        const content = fs.readFileSync(dict.airtable, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.includes('- **')) {
                const match = line.match(/- \*\*([^*]+)\*\*/);
                if (match) {
                    airtableFields.push(match[1]);
                }
            }
        }
    }

    const missingFields = [];
    for (const af of airtableFields) {
        if (!mappedFields.has(af)) {
            missingFields.push(af);
        }
    }

    // Merge missing from Airtable and unmapped from Dict
    const allMissing = new Set([...unmappedInDict, ...missingFields]);

    results[dict.model] = Array.from(allMissing);
}

fs.writeFileSync('audit_results.json', JSON.stringify(results, null, 2));
console.log('Audit complete, results saved to audit_results.json');
