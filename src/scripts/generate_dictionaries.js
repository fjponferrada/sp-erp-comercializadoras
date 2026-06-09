const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const backupDir = path.join('C:', 'Users', 'Administrator', 'tmp_backup');

const tablesInfo = [
    { name: 'LEADS', file: 'airtable-leads.txt' },
    { name: 'CONTRATOS', file: 'airtable-contratos.txt' },
    { name: 'FACTURAS', file: 'airtable-facturas.txt' },
    { name: 'INSTALACIONES', file: 'airtable-instalaciones.txt' },
    { name: 'CLIENTES', file: 'airtable-clientes.txt' }
];

const mappings = {
    'CONTRATO': { pg: 'contract.contractCode', desc: 'Código único de contrato' },
    'CUPS': { pg: 'supplyPoint.cups', desc: 'Código Universal del Punto de Suministro' },
    'Tarifa': { pg: 'supplyPoint.tariff', desc: 'Tarifa de acceso (ej. 2.0TD)' },
    'P1P': { pg: 'supplyPoint.p1p / contract.customP1P', desc: 'Potencia contratada P1' },
    'P1C': { pg: 'supplyPoint.p1c', desc: 'Consumo anual estimado P1' },
    'P1E': { pg: 'contract.customP1E', desc: 'Precio energía P1' },
    'Fee Index': { pg: 'contract.customFee', desc: 'Margen comercial o Fee' },
    'CONSUMO ANUAL KWH': { pg: 'supplyPoint.annualConsumption', desc: 'Consumo anual total estimado' },
    'IBAN': { pg: 'client.iban / lead.iban', desc: 'Número de cuenta bancaria' },
    'Nombre completo Titular': { pg: 'client.businessName / lead.businessName', desc: 'Nombre o Razón social del cliente' },
    'NIF Titular': { pg: 'client.vatNumber / lead.vatNumber', desc: 'DNI o CIF del titular' },
    'Email Contacto': { pg: 'client.contactEmail / lead.email', desc: 'Email de comunicación' },
    'Estado': { pg: 'contract.status / lead.status', desc: 'Estado del registro (Activo, Baja, etc)' },
    'CAU': { pg: 'supplyPoint.cau', desc: 'Código de Autoconsumo' },
    'REFERENCIA CATASTRAL': { pg: 'supplyPoint.cadastralReference', desc: 'Referencia de Catastro' },
    'Numero Factura': { pg: 'invoice.invoiceNumber', desc: 'Número identificador de la factura' },
    'Fecha Factura': { pg: 'invoice.issueDate', desc: 'Fecha de emisión' },
    'Total': { pg: 'invoice.totalAmount', desc: 'Importe total a pagar' },
    'Energía Total Consumida': { pg: 'invoice.totalMWh', desc: 'MWh consumidos en el periodo' }
};

tablesInfo.forEach(tableInfo => {
    const filePath = path.join(backupDir, tableInfo.file);
    if (!fs.existsSync(filePath)) {
        console.warn(`No se encuentra ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const uniqueKeys = new Set();
    
    // We are looking for lines like "FieldNamefldXXXXXXXXXXXXXXText"
    for (let line of lines) {
        line = line.trim();
        const fldIndex = line.indexOf('fld');
        // Valid field IDs in Airtable start with 'fld' and are 17 chars long
        if (fldIndex > 0 && line.length >= fldIndex + 17) {
            const fieldId = line.substring(fldIndex, fldIndex + 17);
            // double check it's alphanumeric
            if (/^fld[a-zA-Z0-9]{14}$/.test(fieldId)) {
                const fieldName = line.substring(0, fldIndex).trim();
                if (fieldName && fieldName !== 'Field Name' && !fieldName.includes('List ')) {
                    uniqueKeys.add(fieldName);
                }
            }
        }
    }

    const rows = Array.from(uniqueKeys).map(name => {
        let map = mappings[name] || {};
        let pgField = map.pg || 'No mapeado';
        
        let desc = map.desc || '';
        if (!desc) {
            if (name.includes('P1') || name.includes('P2')) desc = 'Datos de potencia o precios por periodo';
            else if (name.toLowerCase().includes('fecha')) desc = 'Campo de fecha/timestamp';
            else if (name.toLowerCase().includes('error')) desc = 'Campo de control de errores internos de Make';
            else if (name.toLowerCase().includes('email')) desc = 'Dirección de correo electrónico';
            else desc = 'Pendiente de definir por el usuario';
        }

        return {
            'Nombre Airtable': name,
            'Descripción / Significado': desc,
            'Campo Equivalente PostgreSQL': pgField
        };
    });

    // Ordenar alfabéticamente
    rows.sort((a, b) => a['Nombre Airtable'].localeCompare(b['Nombre Airtable']));

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Diccionario');

    const wscols = [ {wch: 35}, {wch: 60}, {wch: 40} ];
    worksheet['!cols'] = wscols;

    const outPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs', `diccionario_${tableInfo.name.toLowerCase()}.xlsx`);
    xlsx.writeFile(workbook, outPath);
    console.log(`Generado ${outPath} con ${uniqueKeys.size} campos extraídos de la doc API de Airtable.`);
});
