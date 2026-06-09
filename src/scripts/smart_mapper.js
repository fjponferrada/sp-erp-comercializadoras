const xlsx = require('xlsx');
const path = require('path');

const docsDir = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs');
const files = ['diccionario_leads.xlsx', 'diccionario_contratos.xlsx'];

const smartMappings = {
    'PDF Borrador Verificado': 'Control de automatización: Confirmación de borrador de contrato correcto',
    'Contrato enviado': 'Control de automatización (Make): Indica si el contrato ya se envió a Docusign',
    'Generar Borrador': 'Trigger: Botón/Checkbox que dispara el webhook de Make para generar el contrato',
    'SIPS OK': 'Validación SIPS: 1 si es correcto, 0 si falla',
    'Error CP': 'Validación SIPS: 0 indica que el código postal coincide',
    'Error CNAE': 'Validación SIPS: 0 indica que el CNAE coincide',
    'Error Autoconsumo': 'Validación SIPS: 0 indica que la modalidad de autoconsumo coincide',
    'ALTA COMERCIALIZADORA': 'Fecha clave: Transiciona el estado del contrato a Activo automáticamente',
    'BAJA COMERCIALIZADORA': 'Fecha clave: Transiciona el estado del contrato a Finalizado automáticamente',
    'Fecha firma contrato': 'Fecha clave: Transiciona el estado del contrato a Aceptado',
    'P1E': 'Precio energía (€/kWh) P1 - Inyectado en plantilla PDF',
    'P2E': 'Precio energía (€/kWh) P2 - Inyectado en plantilla PDF',
    'P3E': 'Precio energía (€/kWh) P3 - Inyectado en plantilla PDF',
    'P4E': 'Precio energía (€/kWh) P4 - Inyectado en plantilla PDF',
    'P5E': 'Precio energía (€/kWh) P5 - Inyectado en plantilla PDF',
    'P6E': 'Precio energía (€/kWh) P6 - Inyectado en plantilla PDF',
    'P1P': 'Potencia contratada (kW) P1 - Inyectado en plantilla PDF',
    'P2P': 'Potencia contratada (kW) P2 - Inyectado en plantilla PDF',
    'P3P': 'Potencia contratada (kW) P3 - Inyectado en plantilla PDF',
    'P4P': 'Potencia contratada (kW) P4 - Inyectado en plantilla PDF',
    'P5P': 'Potencia contratada (kW) P5 - Inyectado en plantilla PDF',
    'P6P': 'Potencia contratada (kW) P6 - Inyectado en plantilla PDF',
    'P1C': 'Consumo anual estimado P1',
    'Fee Index': 'Margen comercial a aplicar sobre contrato',
    'CNAE SIPS': 'Dato crudo extraído de SIPS para reescribir/validar el introducido',
    'CP SIPS': 'Código postal extraído de SIPS para validación',
    'TIPO ENTRADA': 'Clasificación interna comercial',
    'CAPTACION CLIENTE': 'Modo de captación del cliente',
    'Nombre completo Titular': 'Nombre o Razón social (se inyecta como {{nombretit}} en PDF)',
    'IBAN': 'IBAN para domiciliación (se inyecta en PDF y SEPA)'
};

files.forEach(file => {
    const filePath = path.join(docsDir, file);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let updatedCount = 0;

    const newData = data.map(row => {
        const name = row['Nombre Airtable'];
        const currentDesc = row['Descripción / Significado'] || '';
        
        // Check if user has NOT customized it
        const isDefault = currentDesc.includes('Pendiente de definir') || 
                          currentDesc.includes('Datos de potencia') || 
                          currentDesc.includes('Campo de fecha') || 
                          currentDesc.includes('errores internos') || 
                          currentDesc.includes('correo electrónico');

        if (isDefault && smartMappings[name]) {
            row['Descripción / Significado'] = smartMappings[name];
            updatedCount++;
        }
        return row;
    });

    if (updatedCount > 0) {
        const worksheet = xlsx.utils.json_to_sheet(newData);
        // keep columns width
        worksheet['!cols'] = [ {wch: 35}, {wch: 80}, {wch: 40} ];
        workbook.Sheets[sheetName] = worksheet;
        xlsx.writeFile(workbook, filePath);
        console.log(`Actualizado ${file}: ${updatedCount} descripciones inyectadas por IA.`);
    } else {
        console.log(`Sin cambios en ${file}.`);
    }
});
