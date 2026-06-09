const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const inputFile = 'C:\\Users\\Administrator\\tmp_backup\\airtable-productos.txt';
const outputFile = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs', 'diccionario_productos.xlsx');

const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

const uniqueKeys = new Set();

// Buscar líneas como "FieldNamefldXXXXXXXXXXXXXXText"
for (let line of lines) {
    line = line.trim();
    const fldIndex = line.indexOf('fld');
    if (fldIndex > 0 && line.length >= fldIndex + 17) {
        const fieldId = line.substring(fldIndex, fldIndex + 17);
        if (/^fld[a-zA-Z0-9]{14}$/.test(fieldId)) {
            const fieldName = line.substring(0, fldIndex).trim();
            if (fieldName && fieldName !== 'Field Name' && !fieldName.includes('List ')) {
                uniqueKeys.add(fieldName);
            }
        }
    }
}

// Lógica experta
function guessMeaningAndPg(key) {
    const k = key.toLowerCase();
    
    // Energía
    if (k.match(/^p[1-6]e$/)) return {
        desc: `(IA) Precio de la energía facturada al cliente en el periodo ${key.toUpperCase()} (€/kWh)`,
        pg: `product.${key.toLowerCase()}`
    };
    if (k.match(/^p[1-6]e_coste$/)) return {
        desc: `(IA) Coste estimado de compra de energía en el mercado para el periodo ${key.replace('_Coste', '').toUpperCase()} (€/kWh)`,
        pg: `product.${key.toLowerCase()}`
    };

    // Potencia
    if (k.match(/^p[1-6]p$/)) return {
        desc: `(IA) Precio del término de potencia facturado al cliente en el periodo ${key.toUpperCase()} (€/kW/día o año)`,
        pg: `product.${key.toLowerCase()}`
    };

    // Indexado y márgenes
    if (k.includes('fee') && !k.includes('excedentes')) return {
        desc: '(IA) Margen de comercialización (Fee) sumado al precio de coste indexado (€/kWh o €/MWh)',
        pg: 'product.fee'
    };
    if (k.includes('pexc')) return {
        desc: '(IA) Precio de compensación de excedentes para autoconsumo',
        pg: 'product.pexc'
    };
    if (k.includes('fee excedentes')) return {
        desc: '(IA) Margen de comercialización aplicado sobre la compensación de excedentes',
        pg: 'product.feeExcedentes'
    };
    if (k.includes('desvios')) return {
        desc: '(IA) Coste estimado por desvíos entre la previsión de consumo y el consumo real',
        pg: 'product.deviationCost'
    };
    if (k.includes('cg bolsillo')) return {
        desc: '(IA) Coste de gestión mensual cobrado al cliente por usar el servicio de Batería Virtual / Bolsillo Solar',
        pg: 'product.cgBolsilloSolar'
    };

    // Parámetros regulatorios
    if (k === 'ip') return {
        desc: '(IA) Impuesto Eléctrico a aplicar sobre la energía y potencia',
        pg: 'product.ip'
    };
    if (k === 'fc') return {
        desc: '(IA) Fondo Nacional de Eficiencia Energética (FNEE) u otro cargo del sistema',
        pg: 'product.fc'
    };
    
    // Categorización
    if (k.includes('tarifa')) return {
        desc: '(IA) Tarifa de acceso ATR compatible con este producto (ej. 2.0TD, 3.0TD)',
        pg: 'product.tariff'
    };
    if (k.includes('tipo')) return {
        desc: '(IA) Tipo de producto comercial (Fijo, Indexado)',
        pg: 'product.type'
    };
    if (k.includes('nombre')) return {
        desc: '(IA) Nombre comercial del producto para mostrar a clientes y comerciales',
        pg: 'product.name'
    };
    if (k.includes('permanencia')) return {
        desc: '(IA) Meses de permanencia obligatoria al contratar este producto',
        pg: 'product.permanenceMonths'
    };
    if (k.includes('gas')) return {
        desc: '(IA) Indica si este producto lleva suministro de gas asociado o es dual',
        pg: 'product.gasIncluido'
    };

    return {
        desc: 'Pendiente de definir por el usuario...',
        pg: 'Por determinar...'
    };
}

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
worksheet['!cols'] = [ {wch: 35}, {wch: 80}, {wch: 40} ];
xlsx.utils.book_append_sheet(newWorkbook, worksheet, 'Diccionario');
xlsx.writeFile(newWorkbook, outputFile);

console.log(`¡Éxito! Creado diccionario_productos.xlsx con ${excelData.length} campos extraídos de la API.`);
