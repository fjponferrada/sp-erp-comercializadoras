const xlsx = require('xlsx');
const path = require('path');

const leadsPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs', 'diccionario_leads.xlsx');
const workbook = xlsx.readFile(leadsPath);
const sheet = workbook.Sheets['Diccionario'];
const data = xlsx.utils.sheet_to_json(sheet);

console.log('--- Custom Descriptions in LEADS ---');
data.forEach(row => {
    const desc = row['Descripción / Significado'];
    if (desc && 
        !desc.includes('Pendiente de definir') && 
        !desc.includes('Datos de potencia') && 
        !desc.includes('Campo de fecha') && 
        !desc.includes('errores internos') && 
        !desc.includes('correo electrónico')) {
        console.log(`Campo: ${row['Nombre Airtable']}`);
        console.log(`Desc: ${desc}`);
        console.log('-----------------------------------');
    }
});
