const xlsx = require('xlsx');
const path = require('path');

const docsDir = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs');
const filePath = path.join(docsDir, 'diccionario_facturas.xlsx');

function isDefaultDesc(desc) {
    if (!desc) return true;
    return desc.includes('Pendiente de definir') || 
           desc.includes('Datos de potencia') || 
           desc.includes('Campo de fecha') || 
           desc.includes('errores internos') || 
           desc.includes('correo electrónico') ||
           desc.includes('Datos de consumo');
}

// Inyección de conocimiento experto sobre facturación eléctrica en España
const expertKnowledge = {
    // Potencias facturadas
    'P1P_Fac': 'Término de potencia facturado para el periodo P1 (Punta)',
    'P2P_Fac': 'Término de potencia facturado para el periodo P2',
    'P3P_Fac': 'Término de potencia facturado para el periodo P3',
    'P4P_Fac': 'Término de potencia facturado para el periodo P4',
    'P5P_Fac': 'Término de potencia facturado para el periodo P5',
    'P6P_Fac': 'Término de potencia facturado para el periodo P6 (Valle/Festivos)',
    'Importe Potencia': 'Importe total facturado por el término fijo de potencia (suma de todos los periodos)',
    
    // Energías facturadas
    'P1E_Fac': 'Energía consumida y facturada para el periodo P1 (Punta)',
    'P2E_Fac': 'Energía consumida y facturada para el periodo P2',
    'P3E_Fac': 'Energía consumida y facturada para el periodo P3',
    'P4E_Fac': 'Energía consumida y facturada para el periodo P4',
    'P5E_Fac': 'Energía consumida y facturada para el periodo P5',
    'P6E_Fac': 'Energía consumida y facturada para el periodo P6 (Valle/Festivos)',
    'Importe Energia': 'Importe total facturado por el término variable de energía consumida (suma de periodos)',
    
    // Impuestos y regulados
    'Impuesto Electrico': 'Importe del Impuesto Especial sobre la Electricidad (IEE, históricamente 5.1127% o reducido temporalmente)',
    'Alquiler Equipos': 'Coste del alquiler del equipo de medida (contador) facturado por la distribuidora',
    'Bono Social': 'Financiación del Bono Social Eléctrico aplicado al cliente',
    'IVA': 'Importe correspondiente al Impuesto sobre el Valor Añadido (21%, 10% o 5% según legislación vigente)',
    'Total Factura': 'Importe total a pagar por el cliente, con impuestos incluidos',
    'Subtotal': 'Base imponible de la factura (antes de IVA)',
    
    // Penalizaciones y excesos
    'Exceso Potencia': 'Penalización facturada por excesos de demanda de potencia (maxímetro o penalizaciones por cuartos de hora)',
    'Energia Reactiva': 'Penalización por consumo de energía reactiva inductiva o capacitiva fuera de los límites permitidos (normalmente cos fi < 0.95)',
    'Desvios': 'Coste asociado a los desvíos entre la energía comprada en mercado y la realmente consumida',
    
    // Excedentes y Autoconsumo
    'Excedentes Vertidos': 'Energía excedentaria vertida a la red por instalaciones de autoconsumo',
    'Compensacion Excedentes': 'Importe descontado al cliente por la compensación de excedentes (limitado por el valor de la energía consumida)',
    
    // Fechas de facturación
    'Fecha Inicio Factura': 'Primer día del periodo de consumo facturado',
    'Fecha Fin Factura': 'Último día del periodo de consumo facturado',
    'Fecha Emision': 'Fecha en la que se generó y emitió el documento de factura',
    'Fecha Vencimiento': 'Fecha límite para que el cliente realice el pago sin incurrir en mora',
    
    // Estado y Pagos
    'Estado Pago': 'Estado de cobro de la factura (Pendiente, Pagada, Devuelta, Impagada)',
    'Metodo de Pago': 'Forma en la que se abonará la factura (Domiciliación bancaria, Transferencia, Tarjeta)',
    'Fichero Remesa': 'Referencia al fichero SEPA XML utilizado para el cobro masivo en el banco'
};

const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

let updated = 0;
data.forEach(row => {
    const name = row['Nombre Airtable'];
    const currentDesc = row['Descripción / Significado'];

    if (isDefaultDesc(currentDesc)) {
        // Buscar coincidencia exacta o parcial en el conocimiento experto
        for (const [key, desc] of Object.entries(expertKnowledge)) {
            if (name.toLowerCase().includes(key.toLowerCase())) {
                row['Descripción / Significado'] = `(IA) ${desc}`;
                updated++;
                break;
            }
        }
    }
});

if (updated > 0) {
    const worksheet = xlsx.utils.json_to_sheet(data);
    worksheet['!cols'] = [ {wch: 35}, {wch: 80}, {wch: 40} ];
    workbook.Sheets[sheetName] = worksheet;
    xlsx.writeFile(workbook, filePath);
    console.log(`¡Éxito! Se han inyectado ${updated} descripciones inteligentes en el diccionario de facturas.`);
} else {
    console.log(`No se han encontrado campos genéricos que coincidan con la lógica de facturación eléctrica.`);
}
