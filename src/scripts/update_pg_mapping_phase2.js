const xlsx = require('xlsx');
const path = require('path');

const docsDir = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs');

// 1. UPDATE PRODUCTOS DICTIONARY
const productosFile = path.join(docsDir, 'diccionario_productos.xlsx');
if (require('fs').existsSync(productosFile)) {
    const workbook = xlsx.readFile(productosFile);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    let updated = 0;
    data.forEach(row => {
        const desc = row['Descripción / Significado'] || '';
        // If user marked it as "no aplica", set it to ignored
        if (desc.toLowerCase().includes('no aplica')) {
            row['Campo Equivalente PostgreSQL'] = 'No se importa (Ignorado)';
            updated++;
        }
        if (row['Nombre Airtable'] === 'FC' || row['Nombre Airtable'] === 'IP') {
             row['Campo Equivalente PostgreSQL'] = 'No se importa (Nuevo motor de comisiones)';
             updated++;
        }
    });

    if (updated > 0) {
        const worksheet = xlsx.utils.json_to_sheet(data);
        worksheet['!cols'] = [ {wch: 35}, {wch: 80}, {wch: 40} ];
        workbook.Sheets[sheetName] = worksheet;
        xlsx.writeFile(workbook, productosFile);
        console.log(`[Productos] Marcados ${updated} campos como ignorados.`);
    }
}

// 2. UPDATE FACTURAS DICTIONARY
const facturasFile = path.join(docsDir, 'diccionario_facturas.xlsx');
if (require('fs').existsSync(facturasFile)) {
    const workbook = xlsx.readFile(facturasFile);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    // Mapeo experto para facturas basado en schema.prisma -> Invoice
    const invoiceMapping = {
        'P1P_Fac': 'invoice.p1PotenciaContratada', // O la máxima demanda
        'P2P_Fac': 'invoice.p2PotenciaContratada',
        'P3P_Fac': 'invoice.p3PotenciaContratada',
        'P4P_Fac': 'invoice.p4PotenciaContratada',
        'P5P_Fac': 'invoice.p5PotenciaContratada',
        'P6P_Fac': 'invoice.p6PotenciaContratada',
        'P1E_Fac': 'invoice.p1EnergiaActivaConsumida',
        'P2E_Fac': 'invoice.p2EnergiaActivaConsumida',
        'P3E_Fac': 'invoice.p3EnergiaActivaConsumida',
        'P4E_Fac': 'invoice.p4EnergiaActivaConsumida',
        'P5E_Fac': 'invoice.p5EnergiaActivaConsumida',
        'P6E_Fac': 'invoice.p6EnergiaActivaConsumida',
        'Energia Reactiva': 'invoice.energiaReactivaTotalConsumida',
        'P1R_Fac': 'invoice.p1EnergiaReactivaConsumida',
        'Impuesto Electrico': 'invoice.taxAmount',
        'Total Factura': 'invoice.totalAmount',
        'Subtotal': 'invoice.subtotal1',
        'Importe Energia': 'invoice.subtotal1',
        'Fecha Inicio Factura': 'invoice.billingStart',
        'Fecha Fin Factura': 'invoice.billingEnd',
        'Fecha Emision': 'invoice.issueDate',
        'Fecha Vencimiento': 'invoice.paymentDate',
        'Estado Pago': 'No mapeado (Gestionado por Odoo o ERP financiero)',
        'Numero Factura': 'invoice.invoiceNumber'
    };

    let updated = 0;
    data.forEach(row => {
        const name = row['Nombre Airtable'];
        // Buscar coincidencia parcial o exacta
        for (const [key, pgField] of Object.entries(invoiceMapping)) {
            if (name.toLowerCase().includes(key.toLowerCase())) {
                row['Campo Equivalente PostgreSQL'] = pgField;
                updated++;
                break;
            }
        }
    });

    if (updated > 0) {
        const worksheet = xlsx.utils.json_to_sheet(data);
        worksheet['!cols'] = [ {wch: 35}, {wch: 80}, {wch: 40} ];
        workbook.Sheets[sheetName] = worksheet;
        xlsx.writeFile(workbook, facturasFile);
        console.log(`[Facturas] Mapeados ${updated} campos a PostgreSQL.`);
    }
}
