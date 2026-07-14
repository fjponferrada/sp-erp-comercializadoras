const AdmZip = require('adm-zip');
const zip = new AdmZip('Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/COTIZADOR/COMPODEM/9-C3_liquicomun-2025-11-01T00-00-00Z_2026-07-10T23-59-59_datos.zip');
console.log(zip.getEntries().map(e => e.name));
