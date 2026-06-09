const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const inputFile = 'C:\\Users\\Administrator\\tmp_backup\\airtable-productos.txt';
const outputFile = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs', 'diccionario_productos.xlsx');

// 1. Leer y extraer claves únicas
const rawData = fs.readFileSync(inputFile, 'utf8');
const records = JSON.parse(rawData);

const uniqueKeys = new Set();
records.forEach(record => {
    if (record.fields) {
        Object.keys(record.fields).forEach(key => uniqueKeys.add(key));
    }
});

// 2. Diccionario de lógica experta para Productos
function guessMeaningAndPg(key) {
    const k = key.toLowerCase();
    
    // Energía
    if (k.match(/^p[1-6]e$/)) return {
        desc: `Precio de la energía facturada al cliente en el periodo ${key.toUpperCase()} (€/kWh)`,
        pg: `product.${key.toLowerCase()}`
    };
    if (k.match(/^p[1-6]e_coste$/)) return {
        desc: `Coste estimado de compra de energía en el mercado para el periodo ${key.replace('_Coste', '').toUpperCase()} (€/kWh)`,
        pg: `product.${key.toLowerCase()}`
    };

    // Potencia
    if (k.match(/^p[1-6]p$/)) return {
        desc: `Precio del término de potencia facturado al cliente en el periodo ${key.toUpperCase()} (€/kW/día o año)`,
        pg: `product.${key.toLowerCase()}`
    };

    // Indexado y márgenes
    if (k.includes('fee')) return {
        desc: 'Margen de comercialización (Fee) sumado al precio de coste indexado (€/kWh o €/MWh)',
        pg: 'product.fee'
    };
    if (k.includes('pexc')) return {
        desc: 'Precio de compensación de excedentes para autoconsumo',
        pg: 'product.pexc'
    };
    if (k.includes('fee excedentes')) return {
        desc: 'Margen de comercialización aplicado sobre la compensación de excedentes',
        pg: 'product.feeExcedentes'
    };
    if (k.includes('desvios')) return {
        desc: 'Coste estimado por desvíos entre la previsión de consumo y el consumo real',
        pg: 'product.deviationCost'
    };
    if (k.includes('cg bolsillo')) return {
        desc: 'Coste de gestión mensual cobrado al cliente por usar el servicio de Batería Virtual / Bolsillo Solar',
        pg: 'product.cgBolsilloSolar'
    };

    // Parámetros regulatorios
    if (k === 'ip') return {
        desc: 'Impuesto Eléctrico a aplicar sobre la energía y potencia',
        pg: 'product.ip'
    };
    if (k === 'fc') return {
        desc: 'Fondo Nacional de Eficiencia Energética (FNEE) u otro cargo del sistema',
        pg: 'product.fc'
    };
    
    // Categorización
    if (k.includes('tarifa')) return {
        desc: 'Tarifa de acceso ATR compatible con este producto (ej. 2.0TD, 3.0TD)',
        pg: 'product.tariff'
    };
    if (k.includes('tipo')) return {
        desc: 'Tipo de producto comercial (Fijo, Indexado)',
        pg: 'product.type'
    };
    if (k.includes('nombre')) return {
        desc: 'Nombre comercial del producto para mostrar a clientes y comerciales',
        pg: 'product.name'
    };
    if (k.includes('permanencia')) return {
        desc: 'Meses de permanencia obligatoria al contratar este producto',
        pg: 'product.permanenceMonths'
    };
    if (k.includes('gas')) return {
        desc: 'Indica si este producto lleva suministro de gas asociado o es dual',
        pg: 'product.gasIncluido'
    };

    return {
        desc: 'Pendiente de definir por el usuario...',
        pg: 'Por determinar...'
    };
}

// 3. Generar Excel
const excelData = Array.from(uniqueKeys).sort().map(key => {
    const guess = guessMeaningAndPg(key);
    return {
        'Nombre Airtable': key,
        'Descripción / Significado': guess.desc,
        'Campo Equivalente PostgreSQL': guess.pg
    };
});

const newWorkbook = xlsx.utils.book_new();
const worksheet = xlsx.utils.json_to_sheet(excelData);

// Ajustar ancho de columnas
worksheet['!cols'] = [
    {wch: 35}, // Nombre Airtable
    {wch: 80}, // Descripción
    {wch: 40}  // Campo PostgreSQL
];

xlsx.utils.book_append_sheet(newWorkbook, worksheet, 'Diccionario');
xlsx.writeFile(newWorkbook, outputFile);

console.log(`¡Éxito! Creado diccionario_productos.xlsx con ${excelData.length} campos analizados.`);
