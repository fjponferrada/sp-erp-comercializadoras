const xlsx = require('xlsx');
const path = require('path');

const docsDir = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs');
const files = ['diccionario_leads.xlsx', 'diccionario_contratos.xlsx'];

function isDefaultDesc(desc) {
    if (!desc) return true;
    return desc.includes('Pendiente de definir') || 
           desc.includes('Datos de potencia') || 
           desc.includes('Campo de fecha') || 
           desc.includes('errores internos') || 
           desc.includes('correo electrónico');
}

files.forEach(file => {
    const filePath = path.join(docsDir, file);
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets['Diccionario'];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log(`\n--- Custom Descriptions in ${file.toUpperCase()} ---`);
    let count = 0;
    data.forEach(row => {
        const desc = row['Descripción / Significado'];
        if (desc && !isDefaultDesc(desc)) {
            console.log(`Campo: ${row['Nombre Airtable']}`);
            console.log(`Desc: ${desc}`);
            console.log('-----------------------------------');
            count++;
        }
    });
    console.log(`Total custom fields in ${file}: ${count}`);
});
