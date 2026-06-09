const xlsx = require('xlsx');
const path = require('path');

const docsDir = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs');
const files = ['diccionario_leads.xlsx', 'diccionario_contratos.xlsx', 'diccionario_clientes.xlsx'];

// Diccionario manual de los cambios de refactorización hacia PostgreSQL
const pgMappingOverrides = {
    // Redundancias enviadas a Client
    'DOMICILIO SOC': 'client.billingAddress',
    'CP SOC': 'client.billingPostalCode',
    'POBLACION SOC': 'client.billingCity',
    'PROVINCIA SOC': 'client.billingProvince',
    'Población Titular': 'client.billingCity',
    'Provincia Titular': 'client.billingProvince',
    'Tipo de vía Titular': 'client.billingStreetType',
    'Calle Titular': 'client.billingStreet',
    'Número Titular': 'client.billingNumber',
    'Adicional Titular': 'client.billingAddressAddition',
    'NOMBRERAZON SOCIAL': 'client.businessName',
    'Nombre / Razón social Titular': 'client.businessName',
    'Primer Apellido': 'client.firstName',
    'Segundo Apellido': 'client.lastName',
    'NIF Titular': 'client.vatNumber',
    'CIF': 'client.vatNumber',
    'TLF': 'client.contactPhone',
    'TLF_2': 'client.contactPhone2',
    'TLF_3': 'client.contactPhone3',
    'EMAIL': 'client.contactEmail',
    'EMAIL comercial': 'client.visibilityCommercialEmail',
    'EMAIL sup canal': 'client.visibilitySupervisorEmail',
    'B2B': 'isB2B',
    'TIPO DE CLIENTE': 'client.clientType',
    'NIF Contacto': 'client.contactVat',
    'Nombre Contacto': 'client.contactName',
    'NOMBRE Y APELLIDOS': 'client.contactName',
    '¿Facturas papel?': 'client.paperInvoice',

    // Redundancias enviadas a SupplyPoint
    'CUPS': 'supplyPoint.cups',
    'Tarifa': 'supplyPoint.tariff',
    'Población Instalación': 'supplyPoint.city',
    'Provincia Instalación': 'supplyPoint.province',
    'Tipo de vía Instalación': 'supplyPoint.streetType',
    'Calle Instalación': 'supplyPoint.street',
    'Número Instalación': 'supplyPoint.streetNumber',
    'Adicional Instalación': 'supplyPoint.addressAddition',
    'CNAE': 'supplyPoint.cnae',
    'CNAE SIPS': 'supplyPoint.sipsCnae',
    'CIE Autoconsumo': 'supplyPoint.cieSelfConsumption',
    
    // Potencias que van a SupplyPoint
    'P1C': 'supplyPoint.p1c',
    'P2C': 'supplyPoint.p2c',
    'P3C': 'supplyPoint.p3c',
    'P4C': 'supplyPoint.p4c',
    'P5C': 'supplyPoint.p5c',
    'P6C': 'supplyPoint.p6c',

    // Contract / Lead fields
    '¿Asociar a Bolsillo Solar?': 'asociarBolsilloSolar',
    'AUTOCONSUMO FIJO / INDEX': 'autoconsumoFijoIndex',
    'CG BOLSILLO SOLAR': 'cgBolsilloSolar',
    'Certificado IBAN': 'client.fileIbanCertificate',
    'DNI Apoderado': 'client.fileRepresentativeId'
};

files.forEach(file => {
    const filePath = path.join(docsDir, file);
    if (!require('fs').existsSync(filePath)) return;

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let updated = 0;
    data.forEach(row => {
        const name = row['Nombre Airtable'];
        // Si hay una regla explícita de sobreescritura, la aplicamos a la columna PostgreSQL
        if (pgMappingOverrides[name]) {
            row['Campo Equivalente PostgreSQL'] = pgMappingOverrides[name];
            updated++;
        }
    });

    if (updated > 0) {
        const worksheet = xlsx.utils.json_to_sheet(data);
        worksheet['!cols'] = [ {wch: 35}, {wch: 80}, {wch: 40} ];
        workbook.Sheets[sheetName] = worksheet;
        xlsx.writeFile(workbook, filePath);
        console.log(`[${file}] Actualizados ${updated} mapeos hacia PostgreSQL.`);
    }
});
